import abc
import json
import logging

logger = logging.getLogger(__name__)

class AIProvider(abc.ABC):
    """Abstract Base Class for AI insight providers."""
    
    @abc.abstractmethod
    def generate_insights(self, context: dict) -> list[str]:
        """
        Takes a context dictionary containing financial data and returns a list of insight strings.
        """
        pass


class MockProvider(AIProvider):
    """
    A fallback/mock provider that generates deterministic insights based on the provided context,
    without requiring external API calls.
    """
    def generate_insights(self, context: dict) -> list[str]:
        insights = []
        
        total_expenses = context.get('total_expenses', 0)
        total_budget = context.get('total_budget', 0)
        savings_rate = context.get('savings_rate', 0)
        top_categories = context.get('top_categories', [])
        
        # Insight 1: Budget Health
        if total_budget > 0:
            if total_expenses > total_budget:
                overspend = total_expenses - total_budget
                insights.append(f"⚠️ You've exceeded your monthly budget by {overspend:g}.")
            elif total_expenses > total_budget * 0.8:
                insights.append("Watch out! You're nearing your budget limit for this month.")
            else:
                insights.append(f"Great job staying within your budget. You have {total_budget - total_expenses:g} left.")
                
        # Insight 2: Category Warnings
        if top_categories:
            highest_cat = top_categories[0]
            if highest_cat.get('percentage', 0) > 30:
                insights.append(
                    f"You spent a significant portion ({highest_cat['percentage']}%) "
                    f"on {highest_cat['name']} this month."
                )
            
            # Additional category tip
            if len(top_categories) > 1:
                second_cat = top_categories[1]
                if second_cat['name'].lower() in ['shopping', 'entertainment', 'food']:
                    insights.append(
                        f"Consider reducing your {second_cat['name']} expenses to increase your savings."
                    )
        
        # Insight 3: Savings tip
        if savings_rate < 10:
            insights.append("Try finding small recurring subscriptions you don't use to boost your savings rate above 10%.")
        elif savings_rate > 20:
            insights.append("Fantastic savings rate! Consider investing the surplus to build long-term wealth.")
            
        if not insights:
            insights.append("Keep logging your expenses and budgets to receive personalized insights.")
            
        return insights


class GeminiProvider(AIProvider):
    """
    Implementation for Google Gemini API.
    """
    def generate_insights(self, context: dict) -> list[str]:
        import os
        
        # Example of how you would implement this when the python package is installed
        # from google import genai
        # from google.genai import types
        # client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        
        # Provide a basic fallback until the library is actually used.
        return ["Gemini integration is placeholder. Use MockProvider for now."]


class OpenAIProvider(AIProvider):
    """
    Implementation for OpenAI API.
    """
    def generate_insights(self, context: dict) -> list[str]:
        # Placeholder for OpenAI logic
        return ["OpenAI integration is placeholder. Use MockProvider for now."]


def get_ai_provider() -> AIProvider:
    """Factory function to get the configured AI Provider."""
    from django.conf import settings
    
    provider_name = getattr(settings, 'AI_PROVIDER', 'mock').lower()
    
    if provider_name == 'gemini':
        return GeminiProvider()
    elif provider_name == 'openai':
        return OpenAIProvider()
    else:
        return MockProvider()
