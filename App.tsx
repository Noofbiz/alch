import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Plus, Trash2, RefreshCw, Sparkles, Search, Menu, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { combineElementsWithGemini } from './services/geminiService';
import { AlchemyElement, WorkspaceItem, Recipe } from './types';
import { ElementCard } from './components/ElementCard';

// Initial basic elements
const INITIAL_ELEMENTS: AlchemyElement[] = [
  { name: 'Water', emoji: '💧' },
  { name: 'Fire', emoji: '🔥' },
  { name: 'Earth', emoji: '🌍' },
  { name: 'Air', emoji: '💨' },
];

export default function App() {
  // --- State ---
  const [inventory, setInventory] = useState<AlchemyElement[]>(() => {
    const saved = localStorage.getItem('alchemy_inventory');
    return saved ? JSON.parse(saved) : INITIAL_ELEMENTS;
  });

  const [workspaceItems, setWorkspaceItems] = useState<WorkspaceItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const saved = localStorage.getItem('alchemy_recipes');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCombining, setIsCombining] = useState(false);

  // Use refs for workspace dimensions to calculate collision
  const workspaceRef = useRef<HTMLDivElement>(null);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('alchemy_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('alchemy_recipes', JSON.stringify(recipes));
  }, [recipes]);

  // --- Logic ---

  const addToWorkspace = (element: AlchemyElement) => {
    // Add to center of workspace with some random offset to avoid exact stacking
    const newItem: WorkspaceItem = {
      id: uuidv4(),
      element,
      x: window.innerWidth < 768 ? 50 : 200 + Math.random() * 50,
      y: window.innerWidth < 768 ? 100 : 200 + Math.random() * 50,
    };
    setWorkspaceItems(prev => [...prev, newItem]);
  };

  const clearWorkspace = () => {
    setWorkspaceItems([]);
  };

  const resetProgress = () => {
    if (confirm("Are you sure you want to reset all progress? You will lose all discovered elements.")) {
      setInventory(INITIAL_ELEMENTS);
      setRecipes([]);
      setWorkspaceItems([]);
      localStorage.removeItem('alchemy_inventory');
      localStorage.removeItem('alchemy_recipes');
    }
  };

  const checkCollision = async (draggedItem: WorkspaceItem, finalX: number, finalY: number) => {
    // Simple distance-based collision
    const COLLISION_THRESHOLD = 60; // pixels

    // Find the first item that is close enough, excluding itself
    const targetItem = workspaceItems.find(item => {
      if (item.id === draggedItem.id) return false;
      if (item.isLoading) return false; // Can't combine with loading items

      const dist = Math.sqrt(
        Math.pow((item.x) - (finalX), 2) + 
        Math.pow((item.y) - (finalY), 2)
      );
      return dist < COLLISION_THRESHOLD;
    });

    if (targetItem) {
      await handleCombine(draggedItem, targetItem);
    } else {
      // Just update position
      setWorkspaceItems(prev => prev.map(item => 
        item.id === draggedItem.id ? { ...item, x: finalX, y: finalY } : item
      ));
    }
  };

  const handleCombine = async (itemA: WorkspaceItem, itemB: WorkspaceItem) => {
    // 1. Determine inputs sorted alphabetically to ensure consistency
    const inputs = [itemA.element.name, itemB.element.name].sort();
    const recipeKey = inputs.join('|');

    // 2. Remove originals and place a "Loading" placeholder at the position of itemB (the target)
    const midX = itemB.x;
    const midY = itemB.y;

    const loadingId = uuidv4();
    const loadingItem: WorkspaceItem = {
      id: loadingId,
      element: { name: 'Combining...', emoji: '⏳' },
      x: midX,
      y: midY,
      isLoading: true
    };

    setWorkspaceItems(prev => {
      const filtered = prev.filter(i => i.id !== itemA.id && i.id !== itemB.id);
      return [...filtered, loadingItem];
    });

    setIsCombining(true);

    try {
      // 3. Check if recipe exists locally
      let resultElement: AlchemyElement | null = null;
      const existingRecipe = recipes.find(r => 
        r.inputs[0] === inputs[0] && r.inputs[1] === inputs[1]
      );

      if (existingRecipe) {
        resultElement = existingRecipe.result;
      } else {
        // 4. If not, call Gemini
        resultElement = await combineElementsWithGemini(itemA.element, itemB.element);
        
        if (resultElement) {
           // Save new recipe
           const newRecipe: Recipe = {
             inputs: [inputs[0], inputs[1]],
             result: resultElement
           };
           setRecipes(prev => [...prev, newRecipe]);
        }
      }

      // 5. Update State
      if (resultElement) {
        // Add to inventory if new
        const existsInInventory = inventory.some(el => el.name === resultElement!.name);
        if (!existsInInventory) {
          setInventory(prev => [...prev, resultElement!]);
        }

        // Replace loading item with result
        setWorkspaceItems(prev => prev.map(item => 
          item.id === loadingId 
            ? { ...item, element: resultElement!, isLoading: false }
            : item
        ));
      } else {
        // Failed: Restore original items (maybe slightly offset)
        setWorkspaceItems(prev => {
           const withoutLoading = prev.filter(i => i.id !== loadingId);
           return [
             ...withoutLoading,
             { ...itemA, x: midX - 30, y: midY },
             { ...itemB, x: midX + 30, y: midY }
           ];
        });
        alert("These elements refuse to combine!");
      }

    } catch (e) {
      console.error(e);
      // Restore on error
       setWorkspaceItems(prev => {
           const withoutLoading = prev.filter(i => i.id !== loadingId);
           return [
             ...withoutLoading,
             { ...itemA, x: midX - 30, y: midY },
             { ...itemB, x: midX + 30, y: midY }
           ];
        });
    } finally {
      setIsCombining(false);
    }
  };

  const filteredInventory = inventory.filter(el => 
    el.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* --- Sidebar (Inventory) --- */}
      <div 
        className={`
          fixed inset-y-0 left-0 z-20 w-80 bg-slate-800/90 backdrop-blur-md border-r border-slate-700
          transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
        `}
      >
        <div className="p-4 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Infinite Alchemy
            </h1>
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="md:hidden p-2 hover:bg-slate-700 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search elements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="grid grid-cols-2 gap-2">
            {filteredInventory.map((el) => (
              <ElementCard
                key={el.name}
                name={el.name}
                emoji={el.emoji}
                onClick={() => addToWorkspace(el)}
              />
            ))}
          </div>
          {filteredInventory.length === 0 && (
             <div className="text-center text-slate-500 mt-10">
               No elements found.
             </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-800 text-xs text-slate-400 flex justify-between items-center">
          <span>{inventory.length} discovered</span>
          <button 
             onClick={resetProgress}
             className="hover:text-red-400 transition-colors"
             title="Reset Progress"
          >
            Reset
          </button>
        </div>
      </div>

      {/* --- Main Workspace --- */}
      <div 
        ref={workspaceRef}
        className="flex-1 relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black overflow-hidden"
      >
         {/* Mobile Menu Toggle */}
         {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-10 p-2 bg-slate-800 rounded-lg shadow-lg border border-slate-700 md:hidden"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Toolbar */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
           <button 
            onClick={clearWorkspace}
            className="p-2 bg-slate-800/80 backdrop-blur hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 shadow-lg transition-all"
            title="Clear Workspace"
          >
            <Trash2 size={20} />
          </button>
        </div>

        {/* Workspace Hint */}
        {workspaceItems.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 pointer-events-none select-none">
            <div className="text-center">
              <p className="text-lg">Drag elements from the sidebar</p>
              <p className="text-sm opacity-70">Combine them to discover new things</p>
            </div>
          </div>
        )}

        {/* Draggable Items */}
        {workspaceItems.map((item) => (
          <DraggableItem 
            key={item.id} 
            item={item} 
            onDragEnd={checkCollision}
            onRemove={(id) => setWorkspaceItems(prev => prev.filter(i => i.id !== id))}
          />
        ))}

      </div>
    </div>
  );
}

// --- Helper Component for Framer Motion Drag ---

interface DraggableItemProps {
  item: WorkspaceItem;
  onDragEnd: (item: WorkspaceItem, x: number, y: number) => void;
  onRemove: (id: string) => void;
}

const DraggableItem: React.FC<DraggableItemProps> = ({ item, onDragEnd, onRemove }) => {
  // We use local state for immediate visual feedback during drag, but commit to parent on release
  // Actually, framer motion handles the visual drag. We just need to report the final position.
  
  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.1}
      initial={{ x: item.x, y: item.y, scale: 0, opacity: 0 }}
      animate={{ x: item.x, y: item.y, scale: 1, opacity: 1 }}
      // When dragging starts, bring to front (naive approach: high z-index)
      whileDrag={{ scale: 1.1, zIndex: 100, cursor: 'grabbing' }}
      whileHover={{ scale: 1.05, cursor: 'grab' }}
      onDragEnd={(event, info) => {
        // Calculate absolute position based on drag delta relative to starting position
        // This is a bit tricky with Framer Motion if we want absolute coordinates for collision.
        // Easiest way: The 'point' in info gives us page/client coordinates.
        // We need to convert that relative to the workspace container if the container had an offset,
        // but since our workspace is roughly the whole screen minus sidebar, let's use the element's bounding rect logic or just update based on delta.
        
        // Simpler approach: current position (item.x) + info.offset.x
        const finalX = item.x + info.offset.x;
        const finalY = item.y + info.offset.y;
        onDragEnd(item, finalX, finalY);
      }}
      className="absolute top-0 left-0" // Positioning handled by motion x/y
      onDoubleClick={() => onRemove(item.id)}
    >
      <ElementCard 
        name={item.element.name} 
        emoji={item.element.emoji} 
        isLoading={item.isLoading}
        className="shadow-2xl !bg-slate-800/90 !border-slate-600/50 !text-lg !px-4 !py-3"
      />
    </motion.div>
  );
};
