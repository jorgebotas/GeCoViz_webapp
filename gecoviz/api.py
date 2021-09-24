from django.conf import settings
from django.http import JsonResponse, HttpResponse, HttpResponseNotFound
from ete4 import Tree

from json import load
import time
from .src.query import get_pickle, get_functional_matches, get_newick,\
                       get_context, get_sequence


RESULTS_PATH = settings.BASE_DIR / 'gecoviz/tmp'
PICKLE_PATH = settings.STATIC_ROOT / 'gecoviz/pickle'

def suggestions(request, field, query):
    if field == "ogs":
        path = PICKLE_PATH / 'OG_DESCRIPTION.pickle'
    elif field == "kos":
        path = PICKLE_PATH / 'KO_DESCRIPTION.pickle'
    elif field == "pname":
        path = PICKLE_PATH / 'PNAME_DESCRIPTION.pickle'
    else:
        return HttpResponseNotFound()

    desc_dict = get_pickle(str(path))

    # Return hits in ids
    if len(query) <= 10:
        key_hits = [ { 'id': k, 'desc': v }
                for k,v in desc_dict.items() if k.__contains__(query) ]
        if len(key_hits) > 0:
            return JsonResponse({ 'suggestions': key_hits })

    # Return hits in descriptions
    desc_hits = [ { 'id': k, 'desc': v }
                for k,v in desc_dict.items() if v.__contains__(query) ]
    return JsonResponse({ 'suggestions': desc_hits })


def description(request, field, query):
    if field == "ogs":
        path = PICKLE_PATH / 'OG_DESCRIPTION.pickle'
    elif field == "kos":
        path = PICKLE_PATH / 'KO_DESCRIPTION.pickle'
    else:
        return HttpResponseNotFound()

    desc_dict = get_pickle(str(path))
    return JsonResponse({ "description": desc_dict.get(query, "") })



def emapper(request, field, query):
    matches = get_functional_matches(field, query)
    return JsonResponse({ 'matches': matches })


def tree(request, field, query, taxids):
    tree = get_newick(field, query, taxids.split(','))
    return JsonResponse( { 'tree': tree } )


def context(request, field, query, taxids):
    start = time.time()
    context = get_context(field, query, taxids.split(','))
    print(f'context:  {time.time() - start}')
    return JsonResponse( { 'context': context } )


def seq(request, query):
    sequence = get_sequence(query, fasta=True)
    return HttpResponse(sequence)

