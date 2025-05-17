import React, { useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Keyboard, Platform, FlatList, Modal } from 'react-native';
import { useAppContext } from '@/context/AppContext';
import MealCard from '@/components/MealCard';
import { Meal, WeightEntry } from '@/types';
import { LineChart } from 'react-native-chart-kit';
import PagerView from 'react-native-pager-view';
import { format, subDays, isSameDay, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Dimensions } from 'react-native';
import { Calendar, ArrowLeft, ArrowRight, Filter, Weight as WeightIcon, TrendingUp, Check, X, Trash2, Edit3 } from 'lucide-react-native';

// Weight conversion helpers (needed for display)
const KG_TO_LB = 2.20462;
const kgToLb = (kg: number): number => kg * KG_TO_LB;
const lbToKg = (lb: number): number => lb / KG_TO_LB;
const roundToDecimal = (num: number, decimals: number = 1): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

const screenWidth = Dimensions.get('window').width - 32;

// Define MealType here as well
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function HistoryScreen() {
  const { meals, weightHistory, userProfile, addWeightEntry, editWeightEntry, deleteWeightEntry } = useAppContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [chartMetric, setChartMetric] = useState<MealType | 'calories'>('carbs');
  const [currentPage, setCurrentPage] = useState(0); // Default to page 0 (Meals)
  const [newWeightValue, setNewWeightValue] = useState('');
  const pagerRef = useRef<PagerView>(null);
  
  // State for Edit Modal
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);
  const [editWeightValue, setEditWeightValue] = useState('');
  
  // Get meals for selected date
  const mealsForSelectedDate = useMemo(() => meals.filter(meal => {
    try {
      // Ensure meal.date is a valid string before parsing
      return typeof meal.date === 'string' && isSameDay(parseISO(meal.date), selectedDate);
    } catch (e) {
      console.warn(`Error parsing date for meal ${meal.id}: ${meal.date}`, e);
      return false;
    }
  }), [meals, selectedDate]);
  
  // --- Grouping Logic for Selected Date ---
  const groupedMealsForSelectedDate = useMemo(() => mealsForSelectedDate.reduce((acc, meal) => {
    const type = meal.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(meal);
    return acc;
  }, {} as Record<MealType, Meal[]>), [mealsForSelectedDate]);

  const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

  // --- Render Helper for Meal Groups ---
  const renderMealGroup = (type: MealType) => {
    const mealsOfType = groupedMealsForSelectedDate[type];
    if (!mealsOfType || mealsOfType.length === 0) {
      return null; // Don't render section if no meals of this type for the selected date
    }

    return (
      <View key={type} style={styles.mealGroupContainer}>
        <Text style={styles.mealGroupTitle}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Text>
        {mealsOfType.map((meal) => (
          <MealCard key={meal.id} meal={meal} />
        ))}
      </View>
    );
  };
  
  // Prepare data for the week chart
  const getMacroChartData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();
    
    const dataPoints = last7Days.map(date => {
      const mealsOnDate = meals.filter(meal => {
        try {
          return typeof meal.date === 'string' && isSameDay(parseISO(meal.date), date);
        } catch (e) { return false; }
      });
      
      // Ensure chartMetric is a valid key in meal.macros
      const metricKey = chartMetric === 'calories' ? 'calories' : chartMetric; 
      const totalForDay = mealsOnDate.reduce((total, meal) => {
         return total + (meal.macros[metricKey as keyof typeof meal.macros] || 0);
      }, 0);
      
      return totalForDay;
    });
    
    return {
      labels: last7Days.map(date => format(date, 'MM/dd')),
      datasets: [
        {
          data: dataPoints.length > 0 ? dataPoints : Array(7).fill(0),
          color: () => getMacroChartColor(),
          strokeWidth: 2
        }
      ]
    };
  };
  
  const getMacroChartColor = () => {
    switch (chartMetric) {
      case 'carbs': return '#FF5252';
      case 'protein': return '#FFC107';
      case 'fat': return '#4CAF50';
      case 'calories': return '#2196F3';
      default: return '#4CAF50';
    }
  };
  
  const macroChartConfig = {
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    color: () => getMacroChartColor(),
    strokeWidth: 2,
    barPercentage: 0.5,
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#FFFFFF'
    },
    propsForLabels: {
      fontFamily: 'Inter-Regular',
      fontSize: 10
    }
  };
  
  const changeDate = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setDate(newDate.getDate() - 1);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
      return newDate;
    });
  };
  
  const toggleChartMetric = () => {
    const metrics: (MealType | 'calories')[] = ['carbs', 'fat', 'protein', 'calories'];
    const currentIndex = metrics.indexOf(chartMetric);
    const nextIndex = (currentIndex + 1) % metrics.length;
    setChartMetric(metrics[nextIndex]);
  };
  
  const getMetricLabel = () => {
    switch (chartMetric) {
      case 'carbs': return 'Carbs (g)';
      case 'protein': return 'Protein (g)';
      case 'fat': return 'Fat (g)';
      case 'calories': return 'Calories';
      default: return 'Carbs (g)'; // Should not happen
    }
  };

  // Determine the display unit based on profile
  const displayWeightUnit = userProfile?.weightUnit || 'lb';

  // --- New Weight Chart Logic ---
  const getWeightChartData = () => {
    // Show last 30 days or fewer if less data exists
    const daysToDisplay = Math.min(30, weightHistory.length > 0 ? 30 : 7); // Show at least 7 days range
    const endDate = new Date();
    const startDate = subDays(endDate, daysToDisplay - 1);
    
    // Filter history for the date range
    const relevantHistory = weightHistory.filter(entry => {
        try {
            const entryDate = parseISO(entry.date);
            return isWithinInterval(entryDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
        } catch (e) { return false; }
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort oldest to newest

    if (relevantHistory.length === 0) {
      return { labels: [format(startDate, 'MM/dd'), format(endDate, 'MM/dd')], datasets: [{ data: [0, 0], color: () => '#8884d8' }] };
    }

    console.log(`[WeightHistory] Creating chart with ${relevantHistory.length} entries, display unit: ${displayWeightUnit}`);
    const labels = relevantHistory.map(entry => format(parseISO(entry.date), 'MM/dd'));
    const dataPoints = relevantHistory.map(entry => {
      // Always convert kg values to lb if that's the display unit
      let displayWeight = entry.weight;
      
      // Force kg values to convert to lb
      if (entry.unit === 'kg' && displayWeightUnit === 'lb') {
        displayWeight = kgToLb(entry.weight);
      }
      
      // Handle the reverse case
      if (entry.unit === 'lb' && displayWeightUnit === 'kg') {
        displayWeight = lbToKg(entry.weight);
      }
      
      const finalWeight = roundToDecimal(displayWeight, 1);
      console.log(`[WeightHistory] Chart point: ${entry.weight} ${entry.unit} -> ${finalWeight} ${displayWeightUnit}`);
      return finalWeight;
    });

    // Ensure labels/data have minimum length if needed by chart library
    // Pad start/end if you only have one data point?
    
    return {
      labels: labels.length > 1 ? labels : [format(subDays(parseISO(relevantHistory[0].date), 1), 'MM/dd'), ...labels], // Add dummy label if only one point
      datasets: [
        {
          data: dataPoints.length > 1 ? dataPoints : [dataPoints[0], dataPoints[0]], // Duplicate point if only one
          color: () => '#8884d8', // Example color for weight
          strokeWidth: 2
        }
      ]
    };
  };

  const weightChartConfig = {
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    color: (opacity = 1) => `rgba(136, 132, 216, ${opacity})`, // Match dataset color
    strokeWidth: 2,
    barPercentage: 0.5,
    propsForDots: { r: '6', strokeWidth: '2', stroke: '#FFFFFF' },
    propsForLabels: { fontFamily: 'Inter-Regular', fontSize: 10 }
  };

  // --- Event Handlers ---
  const handlePageChange = (event: any) => {
    setCurrentPage(event.nativeEvent.position);
  };

  const goToPage = (pageIndex: number) => {
    pagerRef.current?.setPage(pageIndex);
  };

  const handleLogWeight = () => {
    const weightNum = parseFloat(newWeightValue);
    if (isNaN(weightNum) || weightNum <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid positive weight.');
      return;
    }

    addWeightEntry({ 
        weight: weightNum,
        unit: displayWeightUnit
    });

    Alert.alert('Success', `Weight logged: ${newWeightValue} ${displayWeightUnit}`);
    setNewWeightValue(''); // Clear input
    Keyboard.dismiss(); // Dismiss keyboard
  };

  // Delete Handler
  const handleDeleteWeight = (entry: WeightEntry) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete the weight entry from ${format(parseISO(entry.date), 'MMM d, yyyy')}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteWeightEntry(entry.id),
        },
      ]
    );
  };

  // Edit Handlers
  const openEditModal = (entry: WeightEntry) => {
    setEditingEntry(entry);
    console.log(`[WeightHistory] Opening edit modal for entry: ${entry.id}, weight: ${entry.weight}, unit: ${entry.unit}, display unit: ${displayWeightUnit}`);
    
    // Always convert from kg to lb if needed
    let displayWeight = entry.weight;
    
    // Force kg values to convert to lb
    if (entry.unit === 'kg' && displayWeightUnit === 'lb') {
      console.log(`[WeightHistory] Converting ${entry.weight} kg to lb for edit`);
      displayWeight = kgToLb(entry.weight);
    }
    
    // Handle the reverse case
    if (entry.unit === 'lb' && displayWeightUnit === 'kg') {
      console.log(`[WeightHistory] Converting ${entry.weight} lb to kg for edit`);
      displayWeight = lbToKg(entry.weight);
    }
    
    const finalWeight = roundToDecimal(displayWeight, 1);
    console.log(`[WeightHistory] Final edit value: ${finalWeight} ${displayWeightUnit}`);
    setEditWeightValue(finalWeight.toString());
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = () => {
    if (!editingEntry) return;

    const weightNum = parseFloat(editWeightValue);
    if (isNaN(weightNum) || weightNum <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid positive weight.');
      return;
    }

    const weightInKgToSave = displayWeightUnit === 'lb' ? lbToKg(weightNum) : weightNum;
    
    editWeightEntry(editingEntry.id, weightInKgToSave);

    // Close modal and reset state
    setIsEditModalVisible(false);
    setEditingEntry(null);
    setEditWeightValue('');
    Keyboard.dismiss();
  };

  // Helper to render a single weight history item (with Edit/Delete)
  const renderWeightHistoryItem = ({ item }: { item: WeightEntry }) => {
    // Debug the entry to see what's happening
    console.log(`[WeightHistory] Rendering entry: ${item.id}, weight: ${item.weight}, unit: ${item.unit}, display unit: ${displayWeightUnit}`);
    
    // Since we want to display in lb, always convert to lb if the item is in kg
    let displayWeight = item.weight;
    
    // Force kg values to convert to lb, since that's what the user wants to see
    if (item.unit === 'kg' && displayWeightUnit === 'lb') {
      console.log(`[WeightHistory] Converting ${item.weight} kg to lb`);
      displayWeight = kgToLb(item.weight);
    }
    
    // In an unlikely case, handle conversion the other way
    if (item.unit === 'lb' && displayWeightUnit === 'kg') {
      console.log(`[WeightHistory] Converting ${item.weight} lb to kg`);
      displayWeight = lbToKg(item.weight);
    }
    
    console.log(`[WeightHistory] Final display weight: ${roundToDecimal(displayWeight, 1)} ${displayWeightUnit}`);

    return (
      <View style={styles.weightLogItem}>
        <View style={styles.weightLogDetails}>
            <Text style={styles.weightLogDate}>{format(parseISO(item.date), 'MMM d, yyyy - h:mm a')}</Text>
            <Text style={styles.weightLogValue}>{roundToDecimal(displayWeight, 1)} {displayWeightUnit}</Text>
        </View>
        <View style={styles.weightLogActions}>
            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionButton}>
                <Edit3 size={18} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteWeight(item)} style={styles.actionButton}>
                <Trash2 size={18} color="#FF5252" />
            </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
        <View style={styles.header}>
        <Text style={styles.title}>History & Trends</Text>
        <Text style={styles.subtitle}>Track your meals and weight progress</Text>
      </View>
      
      <View style={styles.pagerNavContainer}>
        {/* Meal History Button */}
        <TouchableOpacity 
          style={[styles.pagerNavItem, currentPage === 0 && styles.pagerNavItemActive]}
          onPress={() => goToPage(0)} // Navigate to page 0
          activeOpacity={0.7}
        >
            <Text style={[styles.pagerNavText, currentPage === 0 && styles.pagerNavTextActive]}>Meal History</Text>
        </TouchableOpacity>
        
        {/* Weight History Button */}
        <TouchableOpacity 
          style={[styles.pagerNavItem, currentPage === 1 && styles.pagerNavItemActive]}
          onPress={() => goToPage(1)} // Navigate to page 1
          activeOpacity={0.7}
        >
            <Text style={[styles.pagerNavText, currentPage === 1 && styles.pagerNavTextActive]}>Weight History</Text>
        </TouchableOpacity>
      </View>
        
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageChange}
      >
        <ScrollView key="0" style={styles.pageScrollView} contentContainerStyle={styles.pageScrollContent}>
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
                  <View style={styles.chartTitleContainer}>
                    <TrendingUp size={18} color={getMacroChartColor()} />
            <Text style={styles.chartTitle}>7-Day {getMetricLabel()} Trend</Text>
                  </View>
                <TouchableOpacity style={styles.chartToggle} onPress={toggleChartMetric}>
              <Filter size={16} color="#555" />
              <Text style={styles.chartToggleText}>Change</Text>
            </TouchableOpacity>
          </View>
              <LineChart data={getMacroChartData()} width={screenWidth} height={180} chartConfig={macroChartConfig} bezier style={styles.chart}/>
        </View>
        
        <View style={styles.dateSelector}>
                <TouchableOpacity style={styles.dateButton} onPress={() => changeDate('prev')}><ArrowLeft size={20} color="#555" /></TouchableOpacity>
                <View style={styles.dateDisplay}><Calendar size={16} color="#555" /><Text style={styles.dateText}>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</Text></View>
                <TouchableOpacity style={styles.dateButton} onPress={() => changeDate('next')}><ArrowRight size={20} color="#555" /></TouchableOpacity>
        </View>
        
        <Text style={styles.sectionTitle}>Meals on {format(selectedDate, 'MMMM d')}</Text>
        {mealsForSelectedDate.length > 0 ? (
              mealOrder.map(type => renderMealGroup(type))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No meals recorded for this date</Text>
          </View>
        )}
      </ScrollView>

        <ScrollView key="1" style={styles.pageScrollView} contentContainerStyle={styles.pageScrollContent}>
            <View style={styles.chartContainer}>
              <View style={styles.chartHeader}>
                  <View style={styles.chartTitleContainer}>
                    <WeightIcon size={18} color="#8884d8" />
                    <Text style={styles.chartTitle}>Weight Trend ({displayWeightUnit})</Text>
                  </View>
              </View>
              {weightHistory.length > 0 ? (
                  <LineChart
                    data={getWeightChartData()}
                    width={screenWidth}
                    height={180}
                    chartConfig={weightChartConfig}
                    bezier
                    style={styles.chart}
                  />
              ) : (
                  <View style={styles.emptyChartState}>
                    <Text style={styles.emptyStateText}>Log your weight to see the trend.</Text>
                  </View>
              )}
            </View>

            <View style={styles.logWeightContainer}>
                <Text style={styles.logWeightLabel}>Log Current Weight ({displayWeightUnit})</Text>
                <View style={styles.logWeightInputRow}>
                    <TextInput 
                        style={styles.logWeightInput}
                        placeholder={`Enter weight in ${displayWeightUnit}`}
                        keyboardType="numeric"
                        value={newWeightValue}
                        onChangeText={setNewWeightValue}
                    />
                    <TouchableOpacity 
                        style={[styles.logWeightButton, !newWeightValue && styles.logWeightButtonDisabled]}
                        onPress={handleLogWeight}
                        disabled={!newWeightValue}
                    >
                        <Check size={20} color="#fff"/>
                    </TouchableOpacity>
                </View>
            </View>
            
            {weightHistory.length > 0 && (
                <View style={styles.weightLogListContainer}>
                    <Text style={styles.weightLogListTitle}>Recent Entries</Text>
                    <FlatList
                        data={weightHistory}
                        renderItem={renderWeightHistoryItem}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                    />
                </View>
            )}
        </ScrollView>

      </PagerView>

      {/* Edit Weight Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isEditModalVisible}
        onRequestClose={() => {
          setIsEditModalVisible(false);
          setEditingEntry(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Weight Entry</Text>
            {editingEntry && (
              <Text style={styles.modalSubTitle}>
                Original Date: {format(parseISO(editingEntry.date), 'MMM d, yyyy - h:mm a')}
              </Text>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder={`Enter new weight in ${displayWeightUnit}`}
              keyboardType="numeric"
              value={editWeightValue}
              onChangeText={setEditWeightValue}
              autoFocus={true}
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton, !editWeightValue && styles.disabledButton]} 
                onPress={handleSaveEdit}
                disabled={!editWeightValue}
              >
                <Text style={styles.modalButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666',
  },
  pagerNavContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 3,
  },
  pagerNavItem: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderRadius: 6, 
    backgroundColor: 'transparent',
    marginHorizontal: 2,
  },
  pagerNavItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pagerNavText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#555',
  },
  pagerNavTextActive: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#4CAF50',
  },
  pagerView: {
    flex: 1,
  },
  pageScrollView: {
    flex: 1,
  },
  pageScrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 4,
  },
  chartContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  chartTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#333', marginLeft: 8 },
  chartToggle: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#F5F5F5', borderRadius: 8 },
  chartToggleText: { fontFamily: 'Inter-Medium', fontSize: 12, color: '#555', marginLeft: 4 },
  chart: { marginVertical: 8, borderRadius: 16 },
  emptyChartState: { height: 180, justifyContent: 'center', alignItems: 'center' },
  dateSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  dateButton: { padding: 8 },
  dateDisplay: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#333', marginLeft: 8 },
  sectionTitle: { fontFamily: 'Inter-SemiBold', fontSize: 18, color: '#333', marginBottom: 12, marginLeft: 4 },
  mealGroupContainer: { marginBottom: 16 },
  mealGroupTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#555', marginBottom: 8, marginLeft: 4 },
  emptyState: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', marginVertical: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  emptyStateText: { fontFamily: 'Inter-Regular', fontSize: 16, color: '#888' },
  logWeightContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  logWeightLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  logWeightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logWeightInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 10,
  },
  logWeightButton: {
    padding: 12,
    backgroundColor: '#4CAF50', 
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logWeightButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  weightLogListContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8, 
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  weightLogListTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  weightLogItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // Align items vertically
    paddingVertical: 10, // Increased padding slightly
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  weightLogDetails: {
    flex: 1, // Take available space
    marginRight: 10, // Add margin before actions
  },
  weightLogDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
    marginBottom: 2, // Add space between date and value
  },
  weightLogValue: {
    fontFamily: 'Inter-Medium',
    fontSize: 15, // Slightly larger value
    color: '#333',
  },
  weightLogActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8, // Make touch target larger
    marginLeft: 8, // Space between buttons
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
  },
  modalContent: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    marginBottom: 8,
    color: '#333',
  },
   modalSubTitle: {
     fontFamily: 'Inter-Regular',
     fontSize: 13,
     color: '#666',
     marginBottom: 16,
   },
  modalInput: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 24,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1, // Make buttons share width
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#fff',
  },
  cancelButtonText: {
    color: '#555',
  },
  disabledButton: {
     backgroundColor: '#a5d6a7', // Lighter green for disabled save
  },
});