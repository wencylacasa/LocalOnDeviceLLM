/** Types for the AI-generated dashboard spec. */

export type WidgetTheme = 'dark' | 'light' | 'auto';

export interface StatWidget {
  type: 'stat';
  label: string;
  value: string;
  icon?: string;
  color?: string;
  subtext?: string;
}

export interface ChartWidget {
  type: 'chart';
  label: string;
  /** Array of numeric values (max 10 bars rendered). */
  data: number[];
  /** Optional labels for the x-axis, aligned with data. */
  xLabels?: string[];
  color?: string;
}

export interface ProgressWidget {
  type: 'progress';
  label: string;
  /** 0.0 – 1.0 */
  value: number;
  color?: string;
  subtext?: string;
}

export interface ListWidget {
  type: 'list';
  label: string;
  items: string[];
  color?: string;
}

export interface HeaderWidget {
  type: 'header';
  label: string;
  subtext?: string;
  color?: string;
}

export interface ButtonWidget {
  type: 'button';
  label: string;
  color?: string;
}

export interface GridWidget {
  type: 'grid';
  /** Exactly 2 or 4 StatWidgets displayed side-by-side */
  items: StatWidget[];
}

export type Widget =
  | StatWidget
  | ChartWidget
  | ProgressWidget
  | ListWidget
  | HeaderWidget
  | ButtonWidget
  | GridWidget;

export interface DashboardSpec {
  title: string;
  theme?: WidgetTheme;
  widgets: Widget[];
}
