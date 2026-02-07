import React, { useState } from 'react';
import {
  Cog6ToothIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/solid';

export interface WidgetConfig {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  size: 'small' | 'medium' | 'large' | 'full';
}

interface WidgetGridProps {
  widgets: WidgetConfig[];
  onWidgetsChange: (widgets: WidgetConfig[]) => void;
  children: React.ReactNode;
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
}

const WidgetGrid: React.FC<WidgetGridProps> = ({
  widgets,
  onWidgetsChange,
  children,
  isEditMode = false,
  onToggleEditMode,
}) => {
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null);

  const handleDragStart = (widgetId: string) => {
    if (!isEditMode) return;
    setDraggedWidget(widgetId);
  };

  const handleDragOver = (e: React.DragEvent, widgetId: string) => {
    if (!isEditMode || !draggedWidget) return;
    e.preventDefault();
    setDragOverWidget(widgetId);
  };

  const handleDragEnd = () => {
    if (!draggedWidget || !dragOverWidget || draggedWidget === dragOverWidget) {
      setDraggedWidget(null);
      setDragOverWidget(null);
      return;
    }

    const newWidgets = [...widgets];
    const draggedIndex = newWidgets.findIndex((w) => w.id === draggedWidget);
    const dropIndex = newWidgets.findIndex((w) => w.id === dragOverWidget);

    if (draggedIndex !== -1 && dropIndex !== -1) {
      const [removed] = newWidgets.splice(draggedIndex, 1);
      newWidgets.splice(dropIndex, 0, removed);

      // Update order
      newWidgets.forEach((w, i) => {
        w.order = i;
      });

      onWidgetsChange(newWidgets);
    }

    setDraggedWidget(null);
    setDragOverWidget(null);
  };

  const toggleWidgetVisibility = (widgetId: string) => {
    const newWidgets = widgets.map((w) =>
      w.id === widgetId ? { ...w, enabled: !w.enabled } : w
    );
    onWidgetsChange(newWidgets);
  };

  const changeWidgetSize = (widgetId: string, size: WidgetConfig['size']) => {
    const newWidgets = widgets.map((w) =>
      w.id === widgetId ? { ...w, size } : w
    );
    onWidgetsChange(newWidgets);
  };

  const getSizeClasses = (size: WidgetConfig['size']) => {
    switch (size) {
      case 'small':
        return 'col-span-1';
      case 'medium':
        return 'col-span-1 lg:col-span-2';
      case 'large':
        return 'col-span-1 lg:col-span-2 xl:col-span-3';
      case 'full':
        return 'col-span-full';
      default:
        return 'col-span-1';
    }
  };

  // Convert children to array and map to widgets
  const childArray = React.Children.toArray(children);
  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Edit Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isEditMode && (
            <p className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">
              Drag widgets to reorder • Click eye icon to show/hide
            </p>
          )}
        </div>
        <button
          onClick={onToggleEditMode}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            isEditMode
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {isEditMode ? (
            <>
              <CheckIcon className="w-4 h-4" />
              Done
            </>
          ) : (
            <>
              <Cog6ToothIcon className="w-4 h-4" />
              Customize
            </>
          )}
        </button>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {sortedWidgets.map((widget, index) => {
          const childElement = childArray.find(
            (child) =>
              React.isValidElement(child) &&
              child.props['data-widget-id'] === widget.id
          );

          if (!widget.enabled && !isEditMode) return null;

          return (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div
              key={widget.id}
              draggable={isEditMode}
              onDragStart={() => handleDragStart(widget.id)}
              onDragOver={(e) => handleDragOver(e, widget.id)}
              onDragEnd={handleDragEnd}
              className={`${getSizeClasses(widget.size)} ${
                isEditMode
                  ? 'cursor-move ring-2 ring-indigo-200 ring-offset-2 rounded-[2.5rem]'
                  : ''
              } ${
                dragOverWidget === widget.id && draggedWidget !== widget.id
                  ? 'ring-indigo-400 bg-indigo-50/50 rounded-[2.5rem]'
                  : ''
              } ${widget.enabled ? '' : 'opacity-50'} transition-all`}
            >
              {/* Edit Mode Overlay */}
              {isEditMode && (
                <div className="relative">
                  <div className="absolute -top-3 -right-3 z-10 flex items-center gap-1">
                    {/* Visibility Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWidgetVisibility(widget.id);
                      }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-lg ${
                        widget.enabled
                          ? 'bg-white text-slate-600 hover:text-slate-900'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {widget.enabled ? (
                        <EyeIcon className="w-4 h-4" />
                      ) : (
                        <EyeSlashIcon className="w-4 h-4" />
                      )}
                    </button>

                    {/* Size Selector */}
                    <select
                      title="Widget size"
                      value={widget.size}
                      onChange={(e) =>
                        changeWidgetSize(widget.id, e.target.value as WidgetConfig['size'])
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="h-8 px-2 text-xs font-bold bg-white border-0 rounded-lg shadow-lg cursor-pointer"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                      <option value="full">Full</option>
                    </select>
                  </div>

                  {/* Widget Label */}
                  <div className="absolute -top-3 left-4 z-10">
                    <span className="px-2 py-1 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider rounded">
                      {widget.name}
                    </span>
                  </div>
                </div>
              )}

              {childElement}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WidgetGrid;
