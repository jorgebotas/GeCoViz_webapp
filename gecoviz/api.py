from django.conf import settings
from django.http import JsonResponse, HttpResponse
from ete4 import Tree

from json import load

from .src.query.py import get_functional_matches, get_context


RESULTS_PATH = settings.BASE_DIR / 'gecoviz/tmp/'

def emapper(request, field, query):
    matches = get_functional_matches(field, query)
    print(matches)
    return JsonResponse(matches)

def context(request, query):
    get_context(query)

# def context(request, query):
    # og = query.split("_")[0]
    # with open(f'{RESULTS_PATH}/{og}/context/{query}.json') as handle:
        # context = load(handle)
    # return JsonResponse({ 'context': context })
