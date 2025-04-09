import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Storage, Task } from '../../types/storage';
import { 
  getStorageData, 
  setStorageData, 
  checkAndUpdateBadges, 
  getDefaultStorage 
} from '../../utils/storage';
import { useTheme } from '../../context/ThemeContext';

// Simple calendar implementation
const Calendar = ({ 
  selectedDate, 
  onSelectDate,
  tasks,
  isDark
}: { 
  selectedDate: Date; 
  onSelectDate: (date: Date) => void;
  tasks: Task[];
  isDark: boolean;
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Create calendar days for the month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };
  
  const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const firstDayOfMonth = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  
  // Get days with tasks
  const daysWithTasks = tasks.reduce((days: Record<string, number>, task) => {
    if (!task.date) return days; // Skip tasks without dates
    
    const date = new Date(task.date);
    const taskYear = date.getFullYear();
    const taskMonth = date.getMonth();
    
    if (
      taskYear === currentMonth.getFullYear() && 
      taskMonth === currentMonth.getMonth()
    ) {
      const day = date.getDate();
      days[day] = (days[day] || 0) + 1;
    }
    return days;
  }, {});
  
  // Calendar navigation
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  const isSelectedDate = (day: number) => {
    return (
      selectedDate.getDate() === day && 
      selectedDate.getMonth() === currentMonth.getMonth() && 
      selectedDate.getFullYear() === currentMonth.getFullYear()
    );
  };
  
  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day && 
      today.getMonth() === currentMonth.getMonth() && 
      today.getFullYear() === currentMonth.getFullYear()
    );
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Days of the week header
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Create a function to get date for specific day
  const getDateForDay = (day: number) => {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
  };
  
  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={previousMonth}>
          <Text style={[styles.calendarNavButton, { color: isDark ? '#FFFFFF' : '#000000' }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.calendarMonthTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Text>
        <TouchableOpacity onPress={nextMonth}>
          <Text style={[styles.calendarNavButton, { color: isDark ? '#FFFFFF' : '#000000' }]}>→</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.daysOfWeek}>
        {daysOfWeek.map(day => (
          <Text key={day} style={[styles.dayOfWeek, { color: isDark ? '#FFFFFF' : '#000000' }]}>{day}</Text>
        ))}
      </View>
      
      <View style={styles.calendarDays}>
        {/* Empty cells for days before the first day of month */}
        {Array.from({ length: firstDayOfMonth }).map((_, index) => (
          <View key={`empty-${index}`} style={styles.calendarDayEmpty} />
        ))}
        
        {/* Actual days */}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const hasTasks = !!daysWithTasks[day];
          
          return (
            <TouchableOpacity
              key={`day-${day}`}
              style={[
                styles.calendarDay,
                isSelectedDate(day) && styles.selectedDay,
                isToday(day) && styles.today,
              ]}
              onPress={() => onSelectDate(getDateForDay(day))}
            >
              <Text 
                style={[
                  styles.calendarDayText, 
                  { color: isDark ? '#FFFFFF' : '#000000' },
                  isSelectedDate(day) && { color: '#FFFFFF' }
                ]}
              >
                {day}
              </Text>
              {hasTasks && (
                <View style={[
                  styles.taskDot, 
                  { backgroundColor: isSelectedDate(day) ? '#FFFFFF' : '#FF6B00' }
                ]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default function CalendarScreen() {
  const [storage, setStorage] = useState<Storage | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAddTaskModalVisible, setIsAddTaskModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskEffort, setNewTaskEffort] = useState<Task['effort']>('medium');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const { isDark } = useTheme();
  
  useEffect(() => {
    loadData();
  }, []);
  
  async function loadData() {
    const data = await getStorageData();
    
    // Ensure all tasks have a date property
    let needsUpdate = false;
    const todayISOString = new Date().toISOString();
    
    data.tasks = data.tasks.map(task => {
      if (!task.date) {
        needsUpdate = true;
        return { ...task, date: todayISOString };
      }
      return task;
    });
    
    // Save updated tasks if needed
    if (needsUpdate) {
      await setStorageData(data);
    }
    
    setStorage(data);
  }
  
  // Helper function to normalize dates for comparison
  const normalizeDateForComparison = (date: Date | string): string => {
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  
  // Filter tasks for the selected date
  const tasksForSelectedDate = storage?.tasks.filter(task => {
    if (!task.date) return false; // Skip tasks without date
    
    // Compare normalized dates (year-month-day) to avoid time issues
    return normalizeDateForComparison(task.date) === normalizeDateForComparison(selectedDate);
  }) || [];
  
  // Add a task for the selected date
  const handleAddTask = async () => {
    if (!storage || !newTaskTitle.trim()) return;
    
    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      notes: newTaskNotes,
      completed: false,
      effort: newTaskEffort,
      pomodoroCount: 0,
      pomodoroActive: false,
      pomodoroEndTime: null,
      date: selectedDate.toISOString(),
    };
    
    // Check if this is a future task (for the Planner badge)
    const now = new Date();
    const taskDate = new Date(selectedDate);
    const isFutureTask = taskDate.setHours(0,0,0,0) > now.setHours(0,0,0,0);
    
    // Update the stats
    let updatedStats = { ...storage.stats };
    
    // If this is a future task, increment the calendar tasks counter
    if (isFutureTask) {
      updatedStats.calendarTasksCreated += 1;
      
      // Check for Planner badge if we've created 5+ future tasks
      if (updatedStats.calendarTasksCreated >= 5 && 
          !updatedStats.badges.find(b => b.id === 'planner')?.earned) {
        updatedStats = await checkAndUpdateBadges(updatedStats);
      }
    }
    
    const newStorage = {
      ...storage,
      tasks: [...storage.tasks, newTask],
      stats: updatedStats,
    };
    
    await setStorageData(newStorage);
    setStorage(newStorage);
    setNewTaskTitle('');
    setNewTaskNotes('');
    setNewTaskEffort('medium');
    setIsAddTaskModalVisible(false);
  };
  
  // Handle task completion toggle
  const handleToggleTask = async (id: string) => {
    if (!storage) return;
    
    const task = storage.tasks.find(t => t.id === id);
    if (!task) return;
    
    const newTasks = storage.tasks.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    
    const newStorage = {
      ...storage,
      tasks: newTasks,
    };
    
    await setStorageData(newStorage);
    setStorage(newStorage);
  };
  
  // Delete a task
  const handleDeleteTask = async (id: string) => {
    if (!storage) return;
    
    const newTasks = storage.tasks.filter(task => task.id !== id);
    
    const newStorage = {
      ...storage,
      tasks: newTasks,
    };
    
    await setStorageData(newStorage);
    setStorage(newStorage);
  };
  
  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString(undefined, options);
  };
  
  if (!storage) return null;
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F8FAFC' }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>Calendar</Text>
        </View>
        
        <Calendar 
          selectedDate={selectedDate} 
          onSelectDate={setSelectedDate}
          tasks={storage.tasks}
          isDark={isDark}
        />
        
        <View style={styles.selectedDateHeader}>
          <Text style={[styles.selectedDateText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
            {formatDate(selectedDate)}
          </Text>
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: isDark ? '#333333' : '#E2E8F0' }]}
            onPress={() => setIsAddTaskModalVisible(true)}
          >
            <Text style={[styles.addButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>Add Task</Text>
          </TouchableOpacity>
        </View>
        
        {tasksForSelectedDate.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              No tasks for this date
            </Text>
          </View>
        ) : (
          <View style={styles.taskList}>
            {tasksForSelectedDate.map(task => (
              <View 
                key={task.id}
                style={[styles.taskItem, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF' }]}
              >
                <TouchableOpacity
                  style={[styles.checkbox, { 
                    borderColor: isDark ? '#666666' : '#94A3B8',
                    backgroundColor: task.completed ? (isDark ? '#666666' : '#94A3B8') : 'transparent' 
                  }]}
                  onPress={() => handleToggleTask(task.id)}
                >
                  {task.completed && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
                <View style={styles.taskContent}>
                  <Text 
                    style={[
                      styles.taskTitle, 
                      { 
                        color: isDark ? '#FFFFFF' : '#000000',
                        textDecorationLine: task.completed ? 'line-through' : 'none'
                      }
                    ]}
                  >
                    {task.title}
                  </Text>
                  {task.notes ? (
                    <Text style={[styles.taskNotes, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      {task.notes}
                    </Text>
                  ) : null}
                  <View style={[styles.taskEffort, { backgroundColor: isDark ? '#2A2A2A' : '#F1F5F9' }]}>
                    <Text style={[styles.taskEffortText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      {task.effort} ({task.effort === 'easy' ? '5' : task.effort === 'medium' ? '10' : '15'} XP)
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteTask(task.id)}
                >
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      
      {/* Add Task Modal */}
      <Modal
        visible={isAddTaskModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddTaskModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
              Add Task for {formatDate(selectedDate)}
            </Text>
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: isDark ? '#2A2A2A' : '#F1F5F9',
                color: isDark ? '#FFFFFF' : '#000000',
              }]}
              placeholder="Task title..."
              placeholderTextColor={isDark ? '#666666' : '#94A3B8'}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
            />
            
            <TextInput
              style={[styles.notesInput, { 
                backgroundColor: isDark ? '#2A2A2A' : '#F1F5F9',
                color: isDark ? '#FFFFFF' : '#000000',
              }]}
              placeholder="Notes (optional)..."
              placeholderTextColor={isDark ? '#666666' : '#94A3B8'}
              value={newTaskNotes}
              onChangeText={setNewTaskNotes}
              multiline
            />
            
            <Text style={[styles.sectionLabel, { color: isDark ? '#FFFFFF' : '#000000' }]}>Difficulty:</Text>
            <View style={styles.difficultyButtons}>
              <TouchableOpacity
                style={[
                  styles.difficultyButton,
                  { backgroundColor: newTaskEffort === 'easy' ? '#10B981' : (isDark ? '#333333' : '#E2E8F0') }
                ]}
                onPress={() => setNewTaskEffort('easy')}
              >
                <Text style={[
                  styles.difficultyButtonText, 
                  { color: newTaskEffort === 'easy' ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#000000') }
                ]}>
                  Easy (5 XP)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.difficultyButton,
                  { backgroundColor: newTaskEffort === 'medium' ? '#0EA5E9' : (isDark ? '#333333' : '#E2E8F0') }
                ]}
                onPress={() => setNewTaskEffort('medium')}
              >
                <Text style={[
                  styles.difficultyButtonText, 
                  { color: newTaskEffort === 'medium' ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#000000') }
                ]}>
                  Medium (10 XP)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.difficultyButton,
                  { backgroundColor: newTaskEffort === 'hard' ? '#EF4444' : (isDark ? '#333333' : '#E2E8F0') }
                ]}
                onPress={() => setNewTaskEffort('hard')}
              >
                <Text style={[
                  styles.difficultyButtonText, 
                  { color: newTaskEffort === 'hard' ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#000000') }
                ]}>
                  Hard (15 XP)
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: isDark ? '#333333' : '#E2E8F0' }]}
                onPress={() => setIsAddTaskModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  { 
                    backgroundColor: newTaskTitle.trim() ? '#FF6B00' : (isDark ? '#444444' : '#CBD5E1'),
                    opacity: newTaskTitle.trim() ? 1 : 0.5
                  }
                ]}
                onPress={handleAddTask}
                disabled={!newTaskTitle.trim()}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Add Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Calendar styles
  calendarContainer: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calendarMonthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  calendarNavButton: {
    fontSize: 24,
    padding: 8,
  },
  daysOfWeek: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayOfWeek: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 12,
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  calendarDayEmpty: {
    width: '14.28%',
    height: 40,
  },
  calendarDayText: {
    fontSize: 14,
  },
  selectedDay: {
    backgroundColor: '#FF6B00',
    borderRadius: 20,
  },
  today: {
    borderWidth: 1,
    borderColor: '#FF6B00',
    borderRadius: 20,
  },
  taskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  // Selected date header
  selectedDateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    padding: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
  },
  // Task list
  taskList: {
    marginBottom: 24,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  taskNotes: {
    fontSize: 14,
    marginTop: 4,
  },
  taskEffort: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  taskEffortText: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesInput: {
    padding: 12,
    borderRadius: 8,
    height: 100,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  difficultyButtons: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  difficultyButton: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  difficultyButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
}); 