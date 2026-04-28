import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import EventCard from './EventCard';
import './TimelineView.css';

const MOOD_EMOJIS = {
  joyful: '😄', nostalgic: '🌙', proud: '🏆', sad: '💧',
  excited: '⚡', peaceful: '🕊', grateful: '🌸', adventurous: '🗺'
};

export default function TimelineView({ events, view, editMode, onEdit, onDelete, onReorder, onClickMedia, onSelectEvent }) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(events);
    const [removed] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, removed);
    onReorder(items);
  };

  if (view === 'grid') {
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="grid" direction="horizontal">
          {(provided) => (
            <div className="grid-view" ref={provided.innerRef} {...provided.droppableProps}>
              {events.map((event, index) => (
                <Draggable key={event._id} draggableId={event._id} index={index} isDragDisabled={!editMode}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...(editMode ? provided.dragHandleProps : {})}
                      className={`grid-item ${snapshot.isDragging ? 'dragging' : ''}`}
                    >
                      <EventCard event={event} view="grid" editMode={editMode} onEdit={onEdit} onDelete={onDelete} onClickMedia={onClickMedia} onSelectEvent={onSelectEvent} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  }

  // Timeline view
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="timeline">
        {(provided) => (
          <div className="timeline-view" ref={provided.innerRef} {...provided.droppableProps}>
            <div className="timeline-line" />
            {events.map((event, index) => (
              <Draggable key={event._id} draggableId={event._id} index={index} isDragDisabled={!editMode}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`timeline-item ${index % 2 === 0 ? 'left' : 'right'} ${snapshot.isDragging ? 'dragging' : ''}`}
                    style={{ ...provided.draggableProps.style, animationDelay: `${index * 0.08}s` }}
                  >
                    <div className="timeline-dot-wrapper">
                      <div className="timeline-dot" style={{ background: event.color || '#c4813a' }}>
                        <span className="timeline-dot-emoji">{MOOD_EMOJIS[event.mood] || '✦'}</span>
                      </div>
                      <div className="timeline-dot-ring" style={{ borderColor: event.color || '#c4813a' }} />
                    </div>

                    <div className={`timeline-connector ${index % 2 === 0 ? 'left-connector' : 'right-connector'}`} />

                    <div className="timeline-card-wrapper"
                      style={{ cursor: onSelectEvent ? 'pointer' : 'default' }}
                      onClick={() => !editMode && onSelectEvent && onSelectEvent(event)}
                    >
                      {editMode && (
                        <div {...provided.dragHandleProps} className="drag-handle" title="Drag to reorder">
                          ⠿
                        </div>
                      )}
                      <EventCard
                        event={event}
                        view="timeline"
                        editMode={editMode}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onClickMedia={onClickMedia}
                        onSelectEvent={onSelectEvent}
                      />
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
