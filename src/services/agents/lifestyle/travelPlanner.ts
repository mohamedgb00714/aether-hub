/**
 * Travel Planner Agent
 * Trip planning, packing lists, budget estimation, itinerary creation
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from '../baseAgent';
import { AgentInfo } from '../types';
import storage from '../../electronStore';

const TRAVEL_STORAGE_KEY = 'agent_travel_data';

export class TravelPlannerAgent extends BaseAgent {
  info: AgentInfo = {
    id: 'travel-planner',
    name: 'Travel Planner',
    icon: '🧳',
    description: 'Plan trips, create packing lists, estimate budgets, and build detailed itineraries.',
    category: 'lifestyle',
    capabilities: [
      'Trip itinerary creation',
      'Packing list generation',
      'Budget estimation',
      'Destination recommendations',
      'Activity scheduling',
      'Travel document checklist',
      'Time zone planning',
      'Local tips & customs'
    ],
    examplePrompts: [
      'Plan a 5-day trip to Paris',
      'Create a packing list for a beach vacation',
      'Estimate budget for 2 weeks in Japan',
      'Build an itinerary for a weekend city break',
      'What documents do I need for international travel?'
    ],
    color: 'from-cyan-500 to-blue-600'
  };

  getSystemPrompt(): string {
    return `You are a Travel Planner AI Agent. You help users plan memorable, organized trips.

YOUR CAPABILITIES:
- Create day-by-day itineraries with timing and activities
- Generate comprehensive packing lists (weather-appropriate)
- Estimate travel budgets (flights, accommodation, food, activities)
- Suggest destinations based on preferences
- Provide travel document checklists
- Plan for time zones and jet lag
- Include local customs and etiquette tips

ITINERARY STRUCTURE:
- Day-by-day breakdown with morning/afternoon/evening activities
- Include travel time between locations
- Mix must-see attractions with local experiences
- Build in downtime and flexibility
- Suggest meal spots and local specialties

PACKING LIST CATEGORIES:
- Documents & money
- Clothing (weather-appropriate)
- Toiletries & medications
- Electronics & chargers
- Travel accessories
- Activity-specific gear

BUDGET ESTIMATION:
Provide ranges (low/mid/high) for:
- Transport (flights, local transit)
- Accommodation
- Food (street food to restaurants)
- Activities & attractions
- Miscellaneous & souvenirs

RESPONSE FORMAT:
- Use clear day headers and timeline
- Include practical tips and warnings
- Provide alternatives and backup plans
- End with "Pre-Trip Checklist"

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'save_trip_plan',
        description: 'Save a trip plan with itinerary, packing list, and budget.',
        schema: z.object({
          tripName: z.string(),
          plan: z.string().describe('JSON object with destination, dates, itinerary, budget, packingList')
        }),
        func: async ({ tripName, plan }) => {
          try {
            const existing = await storage.get(TRAVEL_STORAGE_KEY) as any || {};
            if (!existing.trips) existing.trips = {};
            existing.trips[tripName] = {
              ...JSON.parse(plan),
              createdAt: new Date().toISOString()
            };
            await storage.set(TRAVEL_STORAGE_KEY, existing);
            return `Saved trip plan: "${tripName}".`;
          } catch (error: any) { return `Error: ${error.message}`; }
        }
      }),

      new DynamicStructuredTool({
        name: 'get_trip_plans',
        description: 'Retrieve saved trip plans.',
        schema: z.object({
          tripName: z.string().optional()
        }),
        func: async ({ tripName }) => {
          try {
            const data = await storage.get(TRAVEL_STORAGE_KEY) as any || {};
            if (!data.trips) return 'No trip plans saved yet.';
            if (tripName) {
              const trip = data.trips[tripName];
              if (!trip) return `Trip "${tripName}" not found.`;
              return JSON.stringify(trip, null, 2);
            }
            return JSON.stringify(Object.keys(data.trips).map(name => ({
              name,
              destination: data.trips[name].destination,
              dates: data.trips[name].dates,
              createdAt: data.trips[name].createdAt
            })), null, 2);
          } catch { return 'No travel data available.'; }
        }
      }),

      new DynamicStructuredTool({
        name: 'generate_packing_list_template',
        description: 'Generate a packing list template based on trip type and duration.',
        schema: z.object({
          tripType: z.enum(['beach', 'city', 'adventure', 'business', 'winter', 'camping']),
          duration: z.number().describe('Trip duration in days'),
          climate: z.enum(['hot', 'cold', 'mild', 'mixed']).optional()
        }),
        func: async ({ tripType, duration, climate = 'mild' }) => {
          const baseItems = {
            documents: ['Passport/ID', 'Travel insurance', 'Tickets/confirmations', 'Credit cards', 'Cash'],
            toiletries: ['Toothbrush/paste', 'Deodorant', 'Sunscreen', 'Medications', 'First aid kit'],
            electronics: ['Phone charger', 'Power bank', 'Adapters', 'Headphones']
          };

          const typeSpecific: any = {
            beach: ['Swimsuit', 'Beach towel', 'Flip flops', 'Sunglasses', 'Hat'],
            city: ['Comfortable shoes', 'Day bag', 'Rain jacket', 'Camera', 'Guidebook'],
            adventure: ['Hiking boots', 'Backpack', 'Water bottle', 'Quick-dry clothes', 'Multi-tool'],
            business: ['Formal clothes', 'Laptop', 'Business cards', 'Portfolio', 'Dress shoes'],
            winter: ['Winter coat', 'Gloves', 'Hat', 'Thermal layers', 'Boots'],
            camping: ['Tent', 'Sleeping bag', 'Camping stove', 'Flashlight', 'Bug spray']
          };

          return JSON.stringify({
            tripType,
            duration: `${duration} days`,
            climate,
            essentials: baseItems,
            specific: typeSpecific[tripType],
            clothingRule: `Pack ${Math.ceil(duration / 2)} outfits and do laundry, or pack light and buy locally`,
            tip: 'Lay everything out, then remove 1/3. You always pack too much!'
          }, null, 2);
        }
      }),

      new DynamicStructuredTool({
        name: 'estimate_trip_budget',
        description: 'Estimate trip budget based on destination and style.',
        schema: z.object({
          destination: z.string(),
          duration: z.number().describe('Days'),
          travelStyle: z.enum(['budget', 'mid-range', 'luxury']).optional()
        }),
        func: async ({ destination, duration, travelStyle = 'mid-range' }) => {
          const multipliers = { budget: 1, 'mid-range': 2, luxury: 4 };
          const baseDaily = 50; // Base budget daily estimate
          const daily = baseDaily * multipliers[travelStyle];

          return JSON.stringify({
            destination,
            duration: `${duration} days`,
            travelStyle,
            estimated: {
              accommodation: `$${daily * 0.4 * duration} (${travelStyle} tier)`,
              food: `$${daily * 0.3 * duration} (local mix)`,
              transport: `$${daily * 0.15 * duration} (metro, taxis)`,
              activities: `$${daily * 0.15 * duration} (attractions, tours)`,
              total: `$${daily * duration} + flights`,
              flightNote: 'Add flight costs separately based on origin'
            },
            tips: [
              'Book accommodation in advance for better rates',
              'Eat where locals eat for authentic & cheap meals',
              'Use public transport and walk when possible',
              'Free walking tours are great for orientation'
            ]
          }, null, 2);
        }
      }),

      new DynamicStructuredTool({
        name: 'get_current_time',
        description: 'Get current date and time.',
        schema: z.object({}),
        func: async () => JSON.stringify({ date: new Date().toLocaleDateString(), day: new Date().toLocaleDateString('en-US', { weekday: 'long' }) })
      })
    ];
  }
}
