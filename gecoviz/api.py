from django.conf import settings
from django.http import JsonResponse, HttpResponse
from ete4 import Tree

from json import load
from .src.query import get_functional_matches, get_context


RESULTS_PATH = settings.BASE_DIR / 'gecoviz/tmp/'

def emapper(request, field, query):
    matches = get_functional_matches(field, query)
    print(matches)
    return JsonResponse({ 'matches': matches })

def context(request, query):
    get_context(query)
