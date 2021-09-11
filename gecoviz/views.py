from django.shortcuts import render

def home(request):
    return render(request, 'gecoviz/home.html', {})

def search(request):
    return render(request, 'gecoviz/search.html', {})
