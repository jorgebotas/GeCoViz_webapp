from django.http import HttpResponse
from django.shortcuts import render

def home(request):
    return render(request, 'gecoviz/home.html', {})

def search(request):
    return render(request, 'gecoviz/search.html', {})

def help(request):
    return render(request, 'gecoviz/help/help.html', {})

def accept_cookies(request):
    response = HttpResponse()
    response.set_cookie("cookies_consent", 1)
    return response

def accept_welcome(request):
    response = HttpResponse()
    response.set_cookie("welcome", 1)
    return response
