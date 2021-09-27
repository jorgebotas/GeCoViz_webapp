from collections import defaultdict, Counter
from django.conf import settings
from ete3 import NCBITaxa, PhyloTree
from ete4 import Tree
import json
import pickle
from pymongo import MongoClient, ASCENDING, DESCENDING
from re import split as resplit
import sys, os
import time

client = MongoClient('10.0.3.1')
db = client.progenomes2
col_emapper = db.emapper2
col_pfam = db.pfam
col_neighs = db.neighs
col_proteins = db.proteins
ncbi = NCBITaxa()


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
representative_genomes = get_list(STATIC_PATH / "txt/representative_genomes.txt")


def get_sequence(query, fasta=True):
    seq = col_proteins.find_one({'n': query}).get('aa', 'Sequence not found')
    print(seq)
    if fasta:
        return '>{}\n{}'.format(query, seq)
    return seq


def get_newick(field, query, taxids):
    emapper_matches = get_emapper_matches(field, query);
    members_in_taxid = defaultdict(list)
    for match in emapper_matches:
        taxid = match.split(".")[0]
        if taxid in taxids:
            members_in_taxid[taxid].append(match)

    taxid_lineages = { t: get_lineage(t) for t in taxids }
    start = time.time()
    if len(taxids) < 2:
        tree = Tree(name=taxids[0])
    else:
        tree = ncbi.get_topology(taxids)

    # all_taxids = [ m.split(".")[0] for m in emapper_matches ]
    # assert all(taxid in all_taxids for taxid in taxids)
    for l in tree:
        if l.name not in taxids:
            print(l.name)

    print(f'Taxids: {len(taxids)}   =====  Tree: {len(tree)}')
    print(f'Taxids: {len(taxids)}   =====  members: {len(members_in_taxid.keys())}')
    print(f'Taxid_lineages: {len(taxids)}   =====  {len(taxid_lineages.keys())}')

    for node in tree.traverse("postorder"):
        if node.is_leaf():
            taxid = node.name
            children = members_in_taxid[taxid]
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


def get_genome_info(field, query, taxids):

    return


def get_context(field, query, taxids):
    start = time.time()
    emapper_matches = get_emapper_matches(field, query);
    # TODO: this could be done in the mongo...
    queries = [ m for m in emapper_matches if m.split(".")[0] in taxids ]
    print(f'get queries:  {time.time() - start}')

    start = time.time()
    matches = col_neighs.find({ 'genes.g': { '$in': queries } })
    print(f'get neighs:  {time.time() - start}')

    count = 0
    nside = 10
    context = []
    for m in matches:
        count += 1
        anchors = (g for g in m["genes"] if g["g"] in queries)
        for anchor in anchors:
            context.extend( { 
                "anchor": anchor["g"],
                "gene": g["g"],
                "seqID": g["g"],
                "pos": int(g["p"] - anchor["p"]),
                "start": g["s"],
                "end": g["e"],
                "strand": g["o"],
            } for g in m["genes"] if abs(g["p"] - anchor["p"]) <= nside)


    start = time.time()
    all_genes = [ g["gene"] for g in context ]
    functional_info = get_functional_annotation(all_genes)
    print(f'get functional_info:  {time.time() - start}')

    context = [ { **gene, **functional_info.get(gene["gene"], {}) }
                for gene in context ]
    return context


def get_lineage(taxid):
    return lineage_dict.get(str(taxid), ["", ])[1:]


def get_taxonomy(queries):
    taxids = [ q.split(".")[0] for q in queries ]
    counter = Counter(taxids)
    taxa = []
    for taxid, n in counter.items():
        lineage = get_lineage(taxid)
        taxa.append({ 
            'id': taxid,
            'lineage': ";".join(lineage),
            'name': lineage[-1],
            'value': n,
            })
    return taxa

def get_tax_levelname(taxid):
    name = og_level_name_dict.get(taxid, "__").split("__")[1]
    if name:
        name += f' ({taxid})'
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

def get_functional_annotation(genes):
    start = time.time()
    matches = list(col_emapper.find({ "q": { "$in": genes } }))
    print(f'emapper in functional_info:  {time.time() - start}')

    start = time.time()
    pfam_matches = { m["q"]: m["pfam"] 
            for m in col_pfam.find({ "q": { "$in": genes } },
                                   { "q": 1, "pfam": 1 }) }
    print(f'pfam in functional_info:  {time.time() - start}')
    start = time.time()

    annotation = {}
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
                "levelName": get_tax_levelname(str(get_og_level(og))),
                "description": get_og_desc(og),
            } for og in set(m.get("ogs", [])) ]

        pfam = [ { "id": p, "description": get_pfam_desc(p) }
                for p in pfam_matches.get(gene, []) ]

        annotation[gene] = { 
                "Gene name": name,
                "Description": description,
                "KEGG pathways": kpaths,
                "KEGG Orthology": kos,
                "eggNOG Orthology": ogs,
                "Pfam": pfam,
                }

    print(f'annotation in functional_info:  {time.time() - start}')

    return annotation


def get_emapper_matches(field, query, representative_only=True, retrieved_field="q"):

    if representative_only:
        mquery = { '$and': [{ field: query}, {'g': {'$in': representative_genomes}} ]}
    else:
        mquery = { field: query }

    if field == "pfam":
        matches = [ m["q"] for m in col_pfam.find({ field: query },
                                                  { "q": 1 }) ]
    else:
        start = time.time()
        matches = col_emapper.find(mquery, { retrieved_field: 1 })
        matches = [ m[retrieved_field] for m in matches ]
    # matches = list(col_emapper.aggregate([
        # { '$match': { field: query} },
        # { '$project': { 'gene' : '$q' } },
        # # { '$group' : { '_id' : "$genome" } } 
        # ]))

    return matches


def get_functional_matches(field, query):
    start = time.time()
    emapper = get_emapper_matches(field, query, True, "g")
    print(f'list:  {time.time() - start}')
    start = time.time()
    taxonomy = get_taxonomy(emapper)
    print(f'taxonomy:  {time.time() - start}')
    return taxonomy
