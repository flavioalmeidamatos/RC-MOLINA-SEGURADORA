export interface DesktopShellInfo {
  shell: 'electron';
  appUrl: string;
  solutionsUrl: string;
}

export interface DesktopEmbedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopSolutionsApi {
  isDesktopShell: true;
  getInfo: () => Promise<DesktopShellInfo>;
  openSolutionsEmbedded: (payload: { bounds: DesktopEmbedBounds }) => Promise<{ success: boolean; bounds: DesktopEmbedBounds }>;
  updateSolutionsEmbeddedBounds: (payload: { bounds: DesktopEmbedBounds }) => Promise<{ success: boolean; bounds?: DesktopEmbedBounds }>;
  closeSolutionsEmbedded: () => Promise<{ success: boolean }>;
  onSolutionsEmbeddedClosed: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    rcMolinaDesktop?: DesktopSolutionsApi;
  }
}
