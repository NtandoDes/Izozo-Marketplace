from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('users.urls')),
    path('api/', include('smes.urls')),
    path('api/', include('agents.urls')),
    path('api/', include('delivery.urls')),
    path('api/', include('categories.urls')),  # Add this
    path('api/', include('products.urls')),    # Add this
    path('api/', include('addresses.urls')),  # Add this
    path('api/', include('orders.urls')),     # Add this
    path('api/', include('cart.urls')),
    path('api/', include('payments.urls')),
    path('api/', include('stats.urls')),  # Add this line
    path('api/', include('notifications.urls')),
    path('api/admin/', include('admin_dashboard.urls')),
]

# Serve static and media files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)