from django.conf import settings
from django.http import JsonResponse, HttpResponse
from ete4 import Tree

from json import load
from .src.query import get_functional_matches, get_context


RESULTS_PATH = settings.BASE_DIR / 'gecoviz/tmp/'

def emapper(request, field, query):
    matches = get_functional_matches(field, query)
    return JsonResponse({ 'matches': matches })

def context(request, field, query, taxids):
    context = get_context(field, query, taxids.split(','))
    return JsonResponse( { 'context': context } )
