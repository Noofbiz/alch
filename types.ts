export interface AlchemyElement {
  name: string;
  emoji: string;
}

export interface WorkspaceItem {
  id: string;
  element: AlchemyElement;
  x: number;
  y: number;
  isLoading?: boolean;
}

export interface CombinationResult {
  name: string;
  emoji: string;
}

export interface Recipe {
  inputs: [string, string]; // Sorted names of input elements
  result: AlchemyElement;
}
