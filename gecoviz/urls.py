from django.urls import path
from . import api
from . import views


urlpatterns = [
    path('', views.index, name='index'),
    path(r'api/emapper/<str:field>/<str:query>/', api.emapper),
    path(r'api/tree/<str:field>/<str:query>/<str:taxids>/', api.tree),
    path(r'api/context/<str:field>/<str:query>/<str:taxids>/', api.context),
]
