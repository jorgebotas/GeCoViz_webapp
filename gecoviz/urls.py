from django.urls import path
from . import api
from . import views


urlpatterns = [
    path('', views.home, name='home'),
    path('help/', views.help),
    path('accept_cookies/', views.accept_cookies),
    path('accept_welcome/', views.accept_welcome),
    path(r'api/suggestions/<str:field>/<str:query>/', api.suggestions),
    path(r'api/description/<str:field>/<str:query>/', api.description),
    path(r'api/emapper/<str:field>/<str:query>/', api.emapper),
    path(r'api/tree/<str:field>/<str:query>/<str:taxids>/', api.tree),
    path(r'api/context/<str:field>/<str:query>/<str:taxids>/', api.context),
    path(r'api/seq/<str:query>/', api.seq),
    path(r'api/ogs_from_seq/', api.ogs_from_seq),
    path(r'api/ogs_from_pname/<str:query>/', api.ogs_from_pname),
]
