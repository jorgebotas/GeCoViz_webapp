from collections import defaultdict, Counter
from django.conf import settings
from ete3 import NCBITaxa
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

def get_set(filePath):
    with open(filePath) as handle:
        return set([ l.strip() for l in handle.readlines() ])

tax_level_dict = get_pickle(STATIC_PATH / "pickle/TAX_LEVELS.pickle")
kpath_dict = get_pickle(STATIC_PATH / "pickle/KEGG_DESCRIPTION.pickle")
ko_dict = get_pickle(STATIC_PATH / "pickle/KO_DESCRIPTION.pickle")
og_level_dict = get_pickle(STATIC_PATH / "pickle/e5_og_levels.pickle")
og_dict = get_pickle(STATIC_PATH / "pickle/OG_DESCRIPTION.pickle")
representative_genomes = get_set(STATIC_PATH / "txt/representative_genomes.txt")


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
    if len(taxids) < 2:
        tree = Tree(name=taxids[0])
    else:
        tree = ncbi.get_topology(taxids)

    all_taxids = [ m.split(".")[0] for m in emapper_matches ]
    assert all(taxid in all_taxids for taxid in taxids)
    for l in tree:
        if l.name not in taxids:
            print(l.name)

    print(f'Taxids: {len(taxids)}   =====  Tree: {len(tree)}')
    print(f'Taxids: {len(taxids)}   =====  members: {len(members_in_taxid.keys())}')
    print(f'Taxid_lineages: {len(taxids)}   =====  {len(taxid_lineages.keys())}')

    for leaf in tree.get_leaves():
        taxid = leaf.name
        children = members_in_taxid[taxid]
        lineage = taxid_lineages.get(taxid, [""])
        last_tax_level = lineage[-1].replace("__", "_")
        if len(children) == 1:
            child_name = children[0].replace(".", "")
            leaf.name = ".".join([ child_name, last_tax_level, *lineage ])
        else:
            for ch in children:
                child_name = ch.replace(".", "")
                leaf.add_child(name=".".join([ child_name, last_tax_level, *lineage ]))
    
    print(f'Matches: {sum(len(m) for m in members_in_taxid.values())}\nTree: {len(tree)}')
    return tree.write()


def get_genome_info(field, query, taxids):

    return


def get_context(field, query, taxids):
    emapper_matches = get_emapper_matches(field, query);
    # TODO: this could be done in the mongo...
    queries = set( m for m in emapper_matches if m.split(".")[0] in taxids )

    matches = col_neighs.find({ 'genes.g': { '$in': queries } })

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


    all_genes = [ g["gene"] for g in context ]
    functional_info = get_emapper_annotation(all_genes)

    context = [ { **gene, **functional_info.get(gene["gene"], {}) }
                for gene in context ]
    return context


def get_lineage(taxid):
    lineage = ncbi.get_lineage(taxid)[1:]

    old_stdout = sys.stdout # backup current stdout
    sys.stdout = open(os.devnull, "w")

    taxid2name = ncbi.get_taxid_translator(lineage)
    ranks = ncbi.get_rank(lineage)

    sys.stdout = old_stdout # reset old stdout

    return [ f'{ranks[tid]}__{taxid2name[tid].replace(".", "")}' for tid in lineage ][1:]


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
    old_stdout = sys.stdout # backup current stdout
    sys.stdout = open(os.devnull, "w")

    lineage = list(ncbi.get_taxid_translator(taxid).values())

    sys.stdout = old_stdout # reset old stdout

    if len(lineage) > 0:
        return lineage[-1]
    else:
        return ""

def get_ko_desc(ko):
    return ko_dict.get(ko, "")

def get_kpath_desc(kpath):
    return kpath_dict.get(kpath[-5:], "")

def get_og_level(og):
    return og_level_dict.get(og, "")

def get_og_desc(og):
    return og_dict.get(og, "")


def get_emapper_annotation(genes):
    matches = col_emapper.find({ "q": { "$in": genes } })

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
                for p in m.get("pfam", []) ]

        annotation[gene] = { 
                "Gene name": name,
                "Description": description,
                "KEGG pathways": kpaths,
                "KEGG Orthology": kos,
                "eggNOG Orthology": ogs,
                "Pfam": pfam,
                }

    return annotation


def get_emapper_matches(field, query, representative_only=True, retrieved_field="q"):

    if representative_only:
        query = { '$and': [{ field: query}, {'g': {'$in': representative_genomes}} ]}
    else:
        query = { field: query }

    start = time.time()
    matches = db.emapper2.find(query, { retrieved_field: 1 })
    # matches = list(col_emapper.aggregate([
        # { '$match': { field: query} },
        # { '$project': { 'gene' : '$q' } },
        # # { '$group' : { '_id' : "$genome" } } 
        # ]))
    print(f'mongo:  {time.time() - start}')

    return ( m[retrieved_field] for m in matches )


def get_functional_matches(field, query):
    start = time.time()
    emapper = get_emapper_matches(field, query, True, "g")
    print(f'list:  {time.time() - start}')
    return get_taxonomy(emapper)
