from collections import defaultdict, Counter
from django.conf import settings
from ete3 import NCBITaxa, Tree
import json
import pickle
from pymongo import MongoClient, ASCENDING, DESCENDING
from re import split as resplit
import sys, os
import time
import requests

client = MongoClient('10.0.3.1')
db = client.progenomes2
col_emapper = db.emapper2
col_pfam = db.pfam
col_neighs = db.neighs
col_proteins = db.proteins
col_genome_info = db.genome_info
gene2ncbi = db.gene2ncbi


STATIC_PATH = settings.BASE_DIR / 'static/gecoviz/'

def get_pickle(filePath):
    """
    Return dict contained in pickle file

    :filePath: path to pickle file
    :returns: dictionary
    """
    with open(filePath, 'rb') as pickle_in:
        pdict = pickle.load(pickle_in)
    return pdict

def get_list(filePath):
    with open(filePath) as handle:
        return [ l.strip() for l in handle.readlines() ]

tax_level_dict = get_pickle(STATIC_PATH / "pickle/TAX_LEVELS.pickle")
kpath_dict = get_pickle(STATIC_PATH / "pickle/KEGG_DESCRIPTION.pickle")
ko_dict = get_pickle(STATIC_PATH / "pickle/KO_DESCRIPTION.pickle")
og_level_dict = get_pickle(STATIC_PATH / "pickle/e5_og_levels.pickle")
og_level_name_dict = get_pickle(STATIC_PATH / "pickle/e5_og_level_names.pickle")
og_dict = get_pickle(STATIC_PATH / "pickle/OG_DESCRIPTION.pickle")
lineage_dict = get_pickle(STATIC_PATH / "pickle/progenomes2_1_reps_lineage.pickle")
pname_lower = get_pickle(STATIC_PATH / "pickle/PNAME_LOWERCASE.pickle")
# pname2ogs = get_pickle(STATIC_PATH / "pickle/PNAME_OGS.pickle")


def get_sequence(query, fasta=True):
    seq = (col_proteins.find_one({'n': query}) or {}).get('aa', 'Sequence not found')
    if fasta:
        return '>{}\n{}'.format(query, seq)
    return seq


def get_pname_og(field, query):
    if field == "pname":
        query = pname_lower.get(str(query).lower(), "")
        match = col_emapper.find_one({ "pname": query }, { "ogs": 1 })
        if match:
            field = "ogs"
            query = match["ogs"][0] if len(match["ogs"]) else ""
    return field, query


def get_newick(field, query, taxids):
    start = time.time()
    field, query = get_pname_og(field, query)
    print(field, query)
    selected_genomes = get_filtered_genomes_from_function(field, query, taxids)
    print(f'get filtered genomes (newick):  {time.time() - start}')

    start = time.time()
    emapper_matches = get_emapper_matches(field, query, selected_genomes)
    print(f'get genes from {len(selected_genomes)} genomes (newick): {time.time() - start}')

    members_in_taxid = defaultdict(list)
    for gene in emapper_matches:
        taxid = gene.split(".")[0]
        members_in_taxid[taxid].append(gene)

    taxid_lineages = { t: get_lineage(t) for t in taxids }
    start = time.time()
    if len(taxids) < 2:
        tree = Tree(name=taxids[0])
    else:
        ncbi = NCBITaxa()
        tree = ncbi.get_topology(taxids)

    print(f'Taxids: {len(taxids)}   =====  Tree: {len(tree)}')
    print(f'Taxids: {len(taxids)}   =====  members: {len(members_in_taxid.keys())}')
    print(f'Taxid_lineages: {len(taxids)}   =====  {len(taxid_lineages.keys())}')

    for node in tree.traverse("postorder"):
        if node.is_leaf():
            taxid = node.name
            children = members_in_taxid[taxid]
            # if len(children) == 0:
                # print("no match in leaf")
                # node.up.children.remove(node)
            lineage = taxid_lineages.get(taxid, [""])
            last_tax_level = lineage[-1].replace("__", "_")
            if len(children) == 1:
                child_name = children[0].replace(".", "")
                node.name = ".".join([ child_name, last_tax_level, *lineage ])
                node.lineage = lineage
            else:
                node.name = ".".join([ "", last_tax_level, *lineage ])
                node.lineage = lineage
                for ch in children:
                    child_name = ch.replace(".", "")
                    child = node.add_child(name=".".join([ child_name, last_tax_level, *lineage ]))
                    child.lineage = lineage
        else:
            lineage = node.children[0].lineage
            if len(children) > 1:
                for child in node.children[1:]:
                    lineage = [ lineage[i] for i in range(min(len(lineage), len(child.lineage)))
                                if lineage[i] == child.lineage[i] ]
            if len(lineage) > 0:
                last_tax_level = lineage[-1].replace("__", "_")
            else:
                last_tax_level = ""
            node.name = ".".join([ "", last_tax_level, *lineage ])
            node.lineage = lineage

    print(f'Tree and NCBI annotation {time.time() - start}')
    
    print(f'Matches: {sum(len(m) for m in members_in_taxid.values())}\nTree: {len(tree)}')
    t = tree.write(features=["name"])
    return t


def get_genome_info(genomes):
    matches = col_genome_info.find({ "genome": { "$in": genomes } },
                                { "_id": 0 })
    return { m["genome"]: { "isolation source": 
        [ { "id": h.replace("_habitat", "") } for h in m["habitats"] ] +
        ([ { "id": "disease_associated" } ] if int(m["disease"]) else []) }
            for m in matches }


def get_context(field, query, taxids):
    context_start = time.time()
    start = time.time()
    field, query = get_pname_og(field, query)
    selected_genomes = get_filtered_genomes_from_function(field, query, taxids)
    print(f'get filtered genomes (context):  {time.time() - start}')

    start = time.time()
    queries = get_emapper_matches(field, query, selected_genomes)
    print(f'get genes from {len(selected_genomes)} genomes (context):  {time.time() - start}')

    start = time.time()
    matches = col_neighs.find({ 'genes.g': { '$in': queries } }, { "genome": 1, "genes": 1, "_id": 0 })
    print(f'get neighs:  {time.time() - start}')

    start = time.time()
    matches = list(matches)
    print(f'get neighs docs {len(matches)}:  {time.time() - start}')

    genome_to_queries = defaultdict(set)
    for q in queries:
        genome = ".".join(q.split(".")[:-1])
        genome_to_queries[genome].add(q)

    start = time.time()
    genome_info = get_genome_info(selected_genomes)
    print(f'get genome_info:  {time.time() - start}')


    start = time.time()
    count = 0
    nside = 10
    context = []
    for m in matches:
        count += 1
        queries_in_genome = genome_to_queries[m["genome"]]
        anchors = ( (idx, g) for idx, g in enumerate(m["genes"]) if g["g"] in queries_in_genome )
        for idx, anchor in anchors:
            neighbors = m["genes"][max(0, idx - nside) : idx + nside + 1]
            context.extend( { 
                "anchor": anchor["g"],
                "gene": g["g"],
                "genome": ".".join(g["g"].split(".")[:2]),
                "seqID": g["g"],
                "protein": [{ "id": get_ncbi(g["g"]), "description": get_ncbi_desc(g["g"]) }]\
                           if get_ncbi(g["g"]) else [],
                "pos": int(g["p"] - anchor["p"]),
                "start": g["s"],
                "end": g["e"],
                "strand": g["o"],
            } for g in neighbors)

    print(f'get neighs_info:  {time.time() - start}')

    start = time.time()
    all_genes = [ g["gene"] for g in context ]
    functional_info = get_functional_annotation(all_genes)
    print(f'get functional_info:  {time.time() - start}')

    start = time.time()
    context = [ { **gene, 
                  **functional_info.get(gene["gene"], {}),
                  **genome_info.get(gene["genome"], {}), }
                for gene in context ]
    print(f'merge functional and neighs info:  {time.time() - start}')

    print(f'get context:  {time.time() - context_start}')
    return context


def get_lineage(taxid):
    lin = lineage_dict.get(str(taxid), ["", ])
    if lin == ["", ]:
        print(taxid)
    return lin


def get_taxonomy(queries):
    taxids = [ q.split(".")[0] for q in queries ]
    counter = Counter(taxids)
    taxa = []
    for taxid, n in counter.items():
        lineage = get_lineage(taxid)
        taxa.append({ 
            'id': taxid,
            'lineage': ";".join(lineage),
            'name': lineage[-1] if len(lineage) else taxid,
            'value': n,
            })
    return taxa

def get_tax_levelname(taxid):
    name = og_level_name_dict.get(str(taxid), "__").split("__")[1]
    if name:
        name += f' ({taxid})'
    else:
        name = str(taxid)
    return name

def get_ko_desc(ko):
    return ko_dict.get(ko, "")

def get_kpath_desc(kpath):
    return kpath_dict.get(kpath[-5:], "")

def get_og_level(og):
    return og_level_dict.get(og, "")

def get_og_desc(og):
    return og_dict.get(og, "")

def get_pfam_desc(pfam):
    return ""

def get_ncbi(gene):
    """Progenomes gene id to NCBI"""
    ncbi = gene2ncbi.find_one({ "g": gene })
    if ncbi:
        ncbi = f'{ncbi["ncbi"]}  {get_ncbi_desc(ncbi)}'
    return ncbi or ""

def get_ncbi_desc(ncbi):
    if not ncbi:
        return ""
    return ""

def get_functional_annotation(genes):
    start = time.time()
    matches = list(col_emapper.find({ "q": { "$in": genes } }, { "_id": 0  }))
    print(f' (functional_info)  emapper:  {time.time() - start}')

    start_all = time.time()

    annotation = defaultdict(dict)
    for m in matches:
        gene = m["q"]
        name = m.get("pname", "")
        
        description = m.get("?", "")

        kpaths = [ { "id": kp, "description": get_kpath_desc(kp) } 
                for kp in set(m.get("kpath", [])) ]

        kos = [ { "id": ko, "description": get_ko_desc(ko) } 
                for ko in set(m.get("kos", [])) ]

        ogs = [ { 
                "id": og,
                "level": get_og_level(og),
                "levelName": get_tax_levelname(get_og_level(og)),
                "description": get_og_desc(og),
            } for og in set(m.get("ogs", [])) ]

        annotation[gene] = { 
                "Gene name": name,
                "Description": description,
                "KEGG pathways": kpaths,
                "KEGG Orthology": kos,
                "eggNOG Orthology": ogs,
                }

    start = time.time()
    pfam_matches =  col_pfam.find({ "q": { "$in": genes } },
                                   { "q": 1, "pfam": 1, "_id": 0 })

    for m in pfam_matches:
        pfam = [ { "id": p, "description": get_pfam_desc(p) } for p in m["pfam"] ]
        annotation[m["q"]]["Pfam"] = pfam

    print(f' (functional_info)  pfam:  {time.time() - start}')

    

    print(f' (functional_info)  annotation:  {time.time() - start_all}')

    return annotation


def get_filtered_genomes_from_function(field, query, taxids):
    # Get genomes with hits associated to function
    genomes = get_genomes_from_function(field, query)

    # Filter by selected taxids (front front-end SunBurst)
    selected_genomes = [ g for g in genomes if g.split(".")[0] in taxids ]

    return selected_genomes


def get_genomes_from_function(field, query, unique=True):

    field, query = get_pname_og(field, query)

    collection = db[f'repgenomes_{field}']
    matches = ( collection.find_one({ "n": query }) or {} ).get("repg", [])
    
    if unique:
        genomes = [ m[0] for m in matches ]
    else:
        genomes = []
        for m in matches:
            genomes.extend([ m[0] ] * m[1])

    return genomes


def get_emapper_matches(field, query, selected_genomes):
    if field == "pfam":
        matches = col_pfam.aggregate([
                { "$match": { field: query } },
                { "$project": { 
                    "g": { "$concat": [
                        { "$arrayElemAt": [ { "$split": ["$q", "." ] }, 0 ] },
                        ".",
                        { "$arrayElemAt": [ { "$split": ["$q", "." ] }, 1 ] }, ] },
                    "q": "$q" 
                    }
                },
                { "$match": { "g": { "$in": selected_genomes } } },
            ])
    else:
        matches = col_emapper.find(
            {"$and": [{ field: query }, {'g': {'$in': selected_genomes }}]},
            { "q": 1, "_id": 0 })

    return [ m["q"] for m in matches ]


def get_functional_matches(field, query):
    start = time.time()
    emapper = get_genomes_from_function(field, query)
    print(f'list:  {time.time() - start}')
    start = time.time()
    taxonomy = get_taxonomy(emapper)
    print(f'taxonomy:  {time.time() - start}')
    return taxonomy


def get_ogs_from_sequence(sequence):
    nhits = 10

    query = { "fasta": sequence, "nqueries": 1 }

    matches = []

    req =  requests.post('http://eggnogapi5.embl.de/fast_webscan', json=query).json()

    if req: 
        for match in req['seq_matches'][0]['hit']['matches']:

            if len(matches) >= nhits:
                break

            level, og, nseqs, evalue = match['level'], match['nogname'],\
                                       match['nseqs'], match['evalue']
            is_match = db.repgenomes_ogs.find_one({ "n": og }, { "repg": 1 })
            print(og)
            print(is_match)
            if is_match:
                ngenomes = len(is_match.get("repg", []))
                matches.append({
                    "og": og, 
                    "level": get_tax_levelname(level), 
                    "desc": get_og_desc(og), 
                    "nseqs": nseqs, 
                    "ngenomes": ngenomes, 
                    "evalue": evalue,
                    })

    return matches


def get_ogs_from_pname(query):
    query = pname_lower.get(str(query).lower(), "")
    ogs = col_emapper.find({ "pname": query }, { "ogs": 1 })
    print(f'OGs in {query}: {ogs.count_documents()}')
    matches = {}
    for og in ogs:
        if not len(og["ogs"]):
            continue
        og = og["ogs"][0]
        matches[og] = { "og": og, "level": get_tax_levelname(get_og_level(og)), "desc": get_og_desc(og) }
    return list(matches.values())
