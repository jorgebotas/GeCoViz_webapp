from django.http import HtttpResponse
from django.shortcuts import render

def home(request):
    return render(request, 'gecoviz/home.html', {})

def search(request):
    return render(request, 'gecoviz/search.html', {})

def accept_cookies(request):
    response = HtttpResponse()
    response.set_cookie("cookies_consent", 1)
    return response
