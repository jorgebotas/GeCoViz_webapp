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

kegg_dict = get_pickle(STATIC_PATH / "pickle/KEGG_DESCRIPTION.pickle")
# OG level dictionary (for neighborhood sumary)
# TODO: include level in col_og_neigh_scores
og_level_dict = get_pickle(STATIC_PATH / "pickle/e5_og_levels.pickle")


def get_newick(field, query, taxids):
    emapper_matches = get_emapper_matches(field, query);
    genomes = [ ".".join(m.split(".")[0:2]) 
            for m in emapper_matches if m.split(".")[0] in taxids ]
    print(Tree("A"))
    tree = Tree(STATIC_PATH / "trees/progenomes.nw")
    pruned_tree = tree.prune(genomes)
    print(f'Genomes: {len(genomes)}')
    print(f'pruned: {len(pruned_tree)}')
    return pruned_tree.write()


def get_context(field, query, taxids):
    emapper_matches = get_emapper_matches(field, query);
    queries = [ m for m in emapper_matches if m.split(".")[0] in taxids ]
    print(len(taxids))
    print(len(list(set(taxids))))
    print(len(queries))

    matches = col_neighs.find({ 'genes.g': { '$in': queries } })

    count = 0
    nside = 10
    context = []
    for m in matches:
        count += 1
        anchor = next(g for g in m["genes"] if g["g"] in queries)
        context.extend( { 
            "anchor": anchor["g"],
            "gene": g["g"],
            "pos": g["p"] - anchor["p"],
            "start": g["s"],
            "end": g["e"],
            "strand": g["o"],
        } for g in m["genes"] if abs(g["p"] - anchor["p"]) <= nside)


    all_genes = [ g["gene"] for g in context ]
    functional_info = get_emapper_annotation(all_genes)

    context = [ { **gene, **functional_info.get(gene["gene"], {}) }
                for gene in context ]

    print(count)

    return context


def get_lineage(taxid):
    lineage = ncbi.get_lineage(taxid)[1:]
    taxid2name = ncbi.get_taxid_translator(lineage)
    ranks = ncbi.get_rank(lineage)
    return [ f'{ranks[tid]}__{taxid2name[tid]}' for tid in lineage ]


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


def get_ko_desc(ko):
    return ""

def get_kpath_desc(kpath):
    return kegg_dict.get(kpath[-5:], "")

def get_og_level(og):
    return og_level_dict.get(og, "")

def get_og_desc(og):
    return ""

def get_emapper_annotation(genes):
    matches = col_emapper.find({ "q": { "$in": genes } })

    annotation = {}
    for m in matches:
        gene = m["q"]
        name = m.get("pname", "")

        kpaths = [ { "id": kp, "description": get_kpath_desc(kp) } 
                for kp in set(m.get("kpath", [])) ]

        kos = [ { "id": ko, "description": get_ko_desc(ko) } 
                for ko in set(m.get("kos", [])) ]

        ogs = [ { 
                "id": og,
                "level": get_og_level(og),
                "description": get_og_desc(og) 
            } for og in set(m.get("ogs", [])) ]

        annotation[gene] = { 
                "Gene name": name,
                "KEGG pathways": kpaths,
                "KEGG Orthology": kos,
                "Orthologous groups": ogs, }

    return annotation


def get_emapper_matches(field, query):
    if field == 'pname':
        mongo_query = { field: query }
    else:
        mongo_query = { field: { '$elemMatch': { '$eq': query } } }

    matches = col_emapper.find(mongo_query, { 'q': 1 })

    return [ m['q'] for m in matches ]


def get_functional_matches(field, query):
    emapper = get_emapper_matches(field, query)
    return get_taxonomy(emapper)
