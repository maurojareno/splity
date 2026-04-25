import { LayoutTemplate } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { AppDrawer } from '~/components/ui/drawer';
import { Button } from '~/components/ui/button';
import { BUDGET_TEMPLATES, type BudgetTemplate } from '~/lib/budget-templates';

interface BudgetTemplateDrawerProps {
  trigger?: React.ReactNode;
  onSelect: (template: BudgetTemplate) => void;
}

export const BudgetTemplateDrawer: React.FC<BudgetTemplateDrawerProps> = ({
  trigger,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const drawerTrigger = trigger ?? (
    <Button size="icon" variant="ghost" aria-label={t('budget.use_template')}>
      <LayoutTemplate className="h-4 w-4" />
    </Button>
  );

  return (
    <AppDrawer
      trigger={drawerTrigger}
      title={t('budget.use_template')}
      open={open}
      onOpenChange={setOpen}
    >
      <div className="space-y-2 pb-4">
        {BUDGET_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className="hover:bg-muted/50 w-full rounded-lg border p-3 text-left transition-colors"
            onClick={() => {
              onSelect(template);
              setOpen(false);
            }}
          >
            <div className="mb-1 font-medium">{t(template.nameKey)}</div>
            <div className="text-muted-foreground mb-2 text-xs">{t(template.descriptionKey)}</div>
            <div className="flex flex-wrap gap-1">
              {template.envelopes.slice(0, 5).map((e) => (
                <span key={e.nameKey} className="bg-muted rounded-full px-2 py-0.5 text-xs">
                  {e.icon} {t(e.nameKey)}
                </span>
              ))}
              {template.envelopes.length > 5 && (
                <span className="text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                  +{template.envelopes.length - 5}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </AppDrawer>
  );
};
