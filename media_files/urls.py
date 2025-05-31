from django.urls import path
from . import views

app_name = 'media_files'

urlpatterns = [
    # Media file management
    path('', views.media_files_list, name='media_files_list'),
    path('<uuid:file_id>/', views.media_file_detail, name='media_file_detail'),
    
    # File serving
    path('<uuid:file_id>/serve/', views.serve_media_file, name='serve_media_file'),
    path('<uuid:file_id>/audio/', views.serve_audio_file, name='serve_audio_file'),
    
    # Chunked upload
    path('upload/chunk/', views.upload_chunk, name='upload_chunk'),
    path('upload/<uuid:upload_id>/cancel/', views.cancel_upload, name='cancel_upload'),
]
