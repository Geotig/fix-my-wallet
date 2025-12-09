import logging
from django.conf import settings
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django_apscheduler.jobstores import DjangoJobStore
from django_apscheduler.models import DjangoJobExecution
from django_apscheduler import util

logger = logging.getLogger(__name__)

def fetch_emails_job():
    # Esta es la función que se ejecutará periódicamente
    print("⏰ Ejecutando tarea programada: fetch_emails")
    call_command('fetch_emails')

@util.close_old_connections
def delete_old_job_executions(max_age=604_800):
    """Elimina logs de ejecución de trabajos mayores a una semana"""
    DjangoJobExecution.objects.delete_old_job_executions(max_age)

class Command(BaseCommand):
    help = "Runs APScheduler."

    def handle(self, *args, **options):
        scheduler = BlockingScheduler(timezone=settings.TIME_ZONE)
        scheduler.add_jobstore(DjangoJobStore(), "default")

        # 1. Agregar el trabajo principal (Cada 15 minutos)
        scheduler.add_job(
            fetch_emails_job,
            trigger=CronTrigger(minute="*/15"),  # Cada 15 minutos
            id="fetch_emails",
            max_instances=1,
            replace_existing=True,
        )
        logger.info("Added job 'fetch_emails'.")

        # 2. Tarea de limpieza semanal (para no llenar la BD de logs)
        scheduler.add_job(
            delete_old_job_executions,
            trigger=CronTrigger(
                day_of_week="mon", hour="00", minute="00"
            ),
            id="delete_old_job_executions",
            max_instances=1,
            replace_existing=True,
        )

        try:
            logger.info("Starting scheduler...")
            print("🚀 Scheduler iniciado. Ejecutando fetch_emails cada 15 minutos.")
            scheduler.start()
        except KeyboardInterrupt:
            logger.info("Stopping scheduler...")
            scheduler.shutdown()
            print("Scheduler detenido.")