from django.shortcuts import render

def index(request):
    return render(request, 'gecoviz/index.html', {})

def home(request):
    return render(request, 'gecoviz/home.html', {})
