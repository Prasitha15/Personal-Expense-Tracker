from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    currency = models.CharField(max_length=3, default='USD', help_text="User's preferred currency code")
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)

    def __str__(self):
        return self.username
