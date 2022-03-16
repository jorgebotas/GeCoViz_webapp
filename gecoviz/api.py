from django.conf import settings
from django.http import JsonResponse, HttpResponse, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt

from json import load, loads
from .src.query import get_pickle, get_functional_matches, get_newick,\
                       get_context, get_sequence, get_ogs_from_sequence,\
                       get_ogs_from_pname


RESULTS_PATH = settings.BASE_DIR / 'gecoviz/tmp'
PICKLE_PATH = settings.STATIC_ROOT / 'gecoviz/pickle'


def suggestions(request, field, query):
    if field == "ogs":
        path = PICKLE_PATH / 'OG_DESCRIPTION.pickle'
    elif field == "kos":
        path = PICKLE_PATH / 'KO_DESCRIPTION.pickle'
    elif field == "pname":
        path = PICKLE_PATH / 'PNAME_DESCRIPTION.pickle'
    elif field == "pfam":
        path = PICKLE_PATH / 'PFAM_DESCRIPTION.pickle'
    else:
        return HttpResponseNotFound()

    desc_dict = get_pickle(str(path))

    # Return hits in ids
    if len(query) <= 10:
        if field == "pname":
            # Case insensitive search for gene names
            lower = str(query).lower()
            key_hits = [ v for k,v \
                    in get_pickle(PICKLE_PATH / "PNAME_LOWERCASE.pickle").items()\
                    if k.__contains__(lower)]
            key_hits = [ { 'id': k, 'desc': desc_dict.get(k, "") } for k in key_hits ]
        else:
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
    context = get_context(field, query, taxids.split(','))
    return JsonResponse( { 'context': context } )


def seq(request, query):
    sequence = get_sequence(query, fasta=True)
    return HttpResponse(sequence)


@csrf_exempt
def ogs_from_seq(request):
    if request.method == "POST":
        body = loads(request.body.decode('utf-8'))
        seq = body.get("sequence", "")
        matches = get_ogs_from_sequence(seq)
        return JsonResponse({ "matches": matches })


def ogs_from_pname(request, query):
    matches = get_ogs_from_pname(query)
    return JsonResponse({ "matches": matches })
