from django.conf import settings
from django.http import JsonResponse, HttpResponse, HttpResponseNotFound
from ete4 import Tree

from json import load
from .src.query import get_pickle, get_functional_matches, get_newick, get_context


RESULTS_PATH = settings.BASE_DIR / 'gecoviz/tmp'
PICKLE_PATH = settings.STATIC_DIR / 'geco/pickle'

def suggestions(request, field, query):
    if field == "ogs":
        path = PICKLE_PATH / 'OG_DESCRIPTION.pickle'
    elif field == "kos":
        path = PICKLE_PATH / 'KO_DESCRIPTION.pickle'
    else:
        return HttpResponseNotFound()

    desc_dict = get_pickle(str(path))

    # Return hits in ids
    if query.length <= 10:
        keys_hits = [ { 'id': k, 'desc', v }
                for k,v in desc_dict.items() if k.__contains__(query) ]
        if key_hits.length > 0:
            return JsonResponse({ 'suggestions': key_hits })

    # Return hits in descriptions
    desc_hits = [ { 'id': k, 'desc', v }
                for k,v in desc_dict.items() if v.__contains__(query) ]
    return JsonResponse({ 'suggestions': desc_hits })



def emapper(request, field, query):
    matches = get_functional_matches(field, query)
    return JsonResponse({ 'matches': matches })

def tree(request, field, query, taxids):
    tree = get_newick(field, query, taxids.split(','))
    return JsonResponse( { 'tree': tree } )

def context(request, field, query, taxids):
    context = get_context(field, query, taxids.split(','))
    return JsonResponse( { 'context': context } )
