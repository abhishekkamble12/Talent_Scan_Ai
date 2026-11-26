/**
 * Elevated SaaS surface container with crisp 1px border.
 */
export const Panel = ({ children, className = "" }) => (
  <div className={`bg-surface border border-subtle rounded-lg overflow-hidden ${className}`}>
    {children}
  </div>
);

/**
 * Consistent panel header with title, optional subtitle, icon/badge, and right-side actions.
 */
export const PanelHeader = ({ title, subtitle, icon: Icon, badge, action, className = "" }) => (
  <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-subtle bg-surface ${className}`}>
    <div className="flex items-center gap-3 min-w-0">
      {Icon && (
        <div className="w-8 h-8 rounded-md bg-elevated border border-subtle flex items-center justify-center text-accent flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-primary tracking-tight truncate">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-tertiary truncate mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
  </div>
);

/**
 * Semantic status badge with restrained SaaS styling.
 */
const BADGE_VARIANTS = {
  neutral: "bg-elevated text-secondary border-subtle",
  accent: "bg-accent-tint text-accent border-accent-border",
  success: "bg-status-success-bg text-status-success border-status-success-border",
  warning: "bg-status-warning-bg text-status-warning border-status-warning-border",
  error: "bg-status-error-bg text-status-error border-status-error-border",
};

export const Badge = ({ children, variant = "neutral", dot = false, className = "" }) => {
  const dotColors = {
    neutral: "bg-tertiary",
    accent: "bg-accent",
    success: "bg-accent",
    warning: "bg-status-warning",
    error: "bg-status-error",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-micro font-medium tabular-nums ${
        BADGE_VARIANTS[variant] || BADGE_VARIANTS.neutral
      } ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};

/**
 * Standardized empty state for panels and tables.
 */
export const EmptyState = ({ icon: Icon, title, description, action, className = "" }) => (
  <div className={`py-10 px-6 text-center border border-dashed border-subtle rounded-md bg-root/30 ${className}`}>
    {Icon && (
      <div className="w-10 h-10 rounded-md bg-elevated border border-subtle flex items-center justify-center mx-auto mb-3 text-tertiary">
        <Icon className="w-5 h-5" />
      </div>
    )}
    <h3 className="text-sm font-medium text-primary">{title}</h3>
    {description && <p className="text-xs text-secondary max-w-sm mx-auto mt-1 leading-relaxed">{description}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);
