export interface BudgetTemplateEnvelope {
  nameKey: string;
  icon: string;
}

export interface BudgetTemplate {
  id: string;
  nameKey: string;
  descriptionKey: string;
  envelopes: BudgetTemplateEnvelope[];
}

export const BUDGET_TEMPLATES: BudgetTemplate[] = [
  {
    id: 'personal',
    nameKey: 'budget.templates.personal.name',
    descriptionKey: 'budget.templates.personal.description',
    envelopes: [
      { nameKey: 'budget.templates.envelopes.rent', icon: '🏠' },
      { nameKey: 'budget.templates.envelopes.groceries', icon: '🛒' },
      { nameKey: 'budget.templates.envelopes.transport', icon: '🚗' },
      { nameKey: 'budget.templates.envelopes.utilities', icon: '💡' },
      { nameKey: 'budget.templates.envelopes.entertainment', icon: '🎭' },
      { nameKey: 'budget.templates.envelopes.health', icon: '❤️' },
      { nameKey: 'budget.templates.envelopes.savings', icon: '💰' },
    ],
  },
  {
    id: 'family',
    nameKey: 'budget.templates.family.name',
    descriptionKey: 'budget.templates.family.description',
    envelopes: [
      { nameKey: 'budget.templates.envelopes.rent', icon: '🏠' },
      { nameKey: 'budget.templates.envelopes.groceries', icon: '🛒' },
      { nameKey: 'budget.templates.envelopes.transport', icon: '🚗' },
      { nameKey: 'budget.templates.envelopes.utilities', icon: '💡' },
      { nameKey: 'budget.templates.envelopes.entertainment', icon: '🎭' },
      { nameKey: 'budget.templates.envelopes.health', icon: '❤️' },
      { nameKey: 'budget.templates.envelopes.savings', icon: '💰' },
      { nameKey: 'budget.templates.envelopes.kids', icon: '🧒' },
      { nameKey: 'budget.templates.envelopes.education', icon: '📚' },
      { nameKey: 'budget.templates.envelopes.pets', icon: '🐶' },
    ],
  },
  {
    id: 'student',
    nameKey: 'budget.templates.student.name',
    descriptionKey: 'budget.templates.student.description',
    envelopes: [
      { nameKey: 'budget.templates.envelopes.rent', icon: '🏠' },
      { nameKey: 'budget.templates.envelopes.groceries', icon: '🛒' },
      { nameKey: 'budget.templates.envelopes.transport', icon: '🚗' },
      { nameKey: 'budget.templates.envelopes.education', icon: '📚' },
      { nameKey: 'budget.templates.envelopes.entertainment', icon: '🎭' },
    ],
  },
];
