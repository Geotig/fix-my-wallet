from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'transactions', views.TransactionViewSet)
router.register(r'accounts', views.AccountViewSet)
router.register(r'groups', views.CategoryGroupViewSet)
router.register(r'categories', views.CategoryViewSet)
router.register(r'payees', views.PayeeViewSet)
router.register(r'email-sources', views.EmailSourceViewSet)
router.register(r'email-rules', views.EmailRuleViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('budget_summary/', views.BudgetSummaryView.as_view(), name='budget_summary'),
    path('budget_assignment/', views.BudgetAssignmentView.as_view(), name='budget_assignment'),
    path('trigger_sync/', views.TriggerSyncView.as_view(), name='trigger_sync'),
    path('import/preview/', views.ImportFileView.as_view(), name='import_preview'),
    path('import/execute/', views.ExecuteImportView.as_view(), name='import_execute'),
]