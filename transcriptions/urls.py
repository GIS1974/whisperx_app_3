from django.urls import path
from . import views

app_name = 'transcriptions'

urlpatterns = [
    # Transcription details
    path('<uuid:file_id>/', views.transcription_detail, name='transcription_detail'),
    path('<uuid:file_id>/status/', views.transcription_status, name='transcription_status'),
    
    # Subtitle file downloads
    path('<uuid:file_id>/download/<str:file_type>/', views.download_subtitle_file, name='download_subtitle_file'),
    
    # Subtitle file serving (for video player)
    path('<uuid:file_id>/serve/<str:file_type>/', views.serve_subtitle_file, name='serve_subtitle_file'),
]
