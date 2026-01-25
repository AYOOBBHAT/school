import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { supabase } from '../../../utils/supabase';
import {
  loadClasses as loadClassesService,
  loadStudentsAdmin,
  loadAllClassFees,
  loadCustomFees as loadCustomFeesService,
  loadTransportRoutes,
  loadTransportFees,
  createClassFee,
  createCustomFee,
  createTransportRoute,
  createTransportFee,
  deleteCustomFee,
  loadFeeVersions,
  hikeClassFee,
  hikeTransportFee,
  loadStudentsForSalary
} from '../../../services/principal.service';
import { Profile, ClassGroup } from '../types';

export default function FeeManagement({ userRole = 'principal' }: { userRole?: 'principal' | 'clerk' }) {
  const [activeTab, setActiveTab] = useState<'class-fees' | 'custom-fees' | 'transport' | 'tracking' | 'hikes'>('class-fees');
  const [loading, setLoading] = useState(false);
  const isClerk = userRole === 'clerk';

  // Fee Categories removed - no longer used

  // Class Fees
  const [classGroups, setClassGroups] = useState<any[]>([]);
  const [classFees, setClassFees] = useState<any[]>([]);
  const [showClassFeeModal, setShowClassFeeModal] = useState(false);
  const [classFeeForm, setClassFeeForm] = useState({
    class_group_id: '',
    name: '',
    amount: '',
    fee_cycle: 'monthly' as 'one-time' | 'monthly' | 'quarterly' | 'yearly',
    due_day: 5,
    notes: ''
  });

  // Custom Fees
  const [customFees, setCustomFees] = useState<any[]>([]);
  const [showCustomFeeModal, setShowCustomFeeModal] = useState(false);
  const [customFeeForm, setCustomFeeForm] = useState({
    class_group_id: '', // Empty string = all classes, or specific class ID
    name: '',
    amount: '',
    fee_cycle: 'monthly' as 'one-time' | 'monthly' | 'quarterly' | 'yearly'
  });

  // Transport
  const [transportRoutes, setTransportRoutes] = useState<any[]>([]);
  const [transportFees, setTransportFees] = useState<any[]>([]);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeForm, setRouteForm] = useState({ route_name: '', bus_number: '', distance_km: '', zone: '', description: '' });
  const [showTransportFeeModal, setShowTransportFeeModal] = useState(false);
  const [transportFeeForm, setTransportFeeForm] = useState({
    route_id: '',
    base_fee: '',
    escort_fee: '0',
    fuel_surcharge: '0',
    fee_cycle: 'monthly' as 'monthly' | 'per-trip' | 'yearly',
    due_day: 5,
    notes: ''
  });

  // Optional Fees - REMOVED
  // Custom Fees - REMOVED
  // Bills - REMOVED
  
  // Students still needed for other features
  const [students, setStudents] = useState<any[]>([]);

  // Fee Tracking
  const [feeTracking, setFeeTracking] = useState<any[]>([]);
  const [selectedTrackingStudent, setSelectedTrackingStudent] = useState<any>(null);
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [generateBillForm, setGenerateBillForm] = useState({
    student_id: '',
    class_group_id: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  // Payments - REMOVED

  // Fee Hikes
  const [selectedFeeForHike, setSelectedFeeForHike] = useState<any>(null);
  const [showHikeModal, setShowHikeModal] = useState(false);
  const [hikeForm, setHikeForm] = useState({
    new_amount: '',
    effective_from_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [feeVersions, setFeeVersions] = useState<any[]>([]);


  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'class-fees') {
      loadClassFees();
    }
    else if (activeTab === 'custom-fees') {
      loadCustomFees();
    }
    else if (activeTab === 'transport') loadTransportData();
    else if (activeTab === 'tracking') loadFeeTracking();
    else if (activeTab === 'hikes') {
      // Load all fee types for hikes tab
      loadClassFees();
      loadTransportData();
      loadCustomFees();
    }
    // Always return cleanup function (even if empty) to avoid React error #310
    return () => {
      // No cleanup needed
    };
  }, [activeTab]);

  const loadInitialData = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const [classesData, studentsData] = await Promise.all([
        loadClassesService(token),
        loadStudentsAdmin(token)
      ]);

      setClassGroups(classesData.classes || []);
      setStudents(studentsData.students || []);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  // loadFeeCategories removed - no longer needed

  const loadClassFees = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await loadAllClassFees(token);
      setClassFees(data.class_fees || []);
    } catch (error) {
      console.error('Error loading class fees:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomFees = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await loadCustomFeesService(token);
      setCustomFees(data.custom_fees || []);
    } catch (error) {
      console.error('Error loading custom fees:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransportData = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const [routesData, feesData] = await Promise.all([
        loadTransportRoutes(token),
        loadTransportFees(token)
      ]);

      setTransportRoutes(routesData.routes || []);
      setTransportFees(feesData.transport_fees || []);
    } catch (error) {
      console.error('Error loading transport data:', error);
    } finally {
      setLoading(false);
    }
  };

  // loadOptionalFees, loadBills, loadPayments - REMOVED

  const handleSaveClassFee = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await createClassFee(token, {
        ...classFeeForm,
        amount: parseFloat(classFeeForm.amount),
        due_day: parseInt(classFeeForm.due_day.toString()),
        fee_category_id: null // Not used anymore
      });

      alert('Class fee saved successfully!');
      setShowClassFeeModal(false);
      setClassFeeForm({
        class_group_id: '',
        name: '',
        amount: '',
        fee_cycle: 'monthly',
        due_day: 5,
        notes: ''
      });
      loadClassFees();
    } catch (error: any) {
      alert(error.message || 'Failed to save class fee');
    }
  };

  const handleSaveCustomFee = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await createCustomFee(token, {
        ...customFeeForm,
        amount: parseFloat(customFeeForm.amount)
      });

      alert('Custom fee saved successfully!');
      setShowCustomFeeModal(false);
      setCustomFeeForm({
        class_group_id: '',
        name: '',
        amount: '',
        fee_cycle: 'monthly'
      });
      loadCustomFees();
    } catch (error: any) {
      alert(error.message || 'Failed to save custom fee');
    }
  };

  const handleSaveRoute = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await createTransportRoute(token, {
        ...routeForm,
        distance_km: routeForm.distance_km ? parseFloat(routeForm.distance_km) : null
      });

      alert('Transport route saved successfully!');
      setShowRouteModal(false);
      setRouteForm({ route_name: '', bus_number: '', distance_km: '', zone: '', description: '' });
      loadTransportData();
    } catch (error: any) {
      alert(error.message || 'Failed to save route');
    }
  };

  const handleSaveTransportFee = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await createTransportFee(token, {
        ...transportFeeForm,
        base_fee: parseFloat(transportFeeForm.base_fee),
        escort_fee: parseFloat(transportFeeForm.escort_fee) || 0,
        fuel_surcharge: parseFloat(transportFeeForm.fuel_surcharge) || 0,
        due_day: parseInt(transportFeeForm.due_day.toString())
      });

      alert('Transport fee saved successfully!');
      setShowTransportFeeModal(false);
      setTransportFeeForm({
        route_id: '',
        base_fee: '',
        escort_fee: '0',
        fuel_surcharge: '0',
        fee_cycle: 'monthly',
        due_day: 5,
        notes: ''
      });
      loadTransportData();
    } catch (error: any) {
      alert(error.message || 'Failed to save transport fee');
    }
  };

  // handleSaveOptionalFee, handleSaveCustomFee, handleGenerateBills, handleSavePayment, viewBill - REMOVED

  const loadFeeTracking = async () => {
    // Fee tracking simplified - bills and payments removed
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      // Get all students with their class and transport fees
      const studentsData = await loadStudentsForSalary(token);
        
      // Create simplified fee tracking data
      const feeTrackingData = (studentsData.students || []).map((student: any) => ({
        student: student,
        total_assigned: 0,
        total_paid: 0,
        pending_amount: 0,
        transport_amount: 0
      }));

      setFeeTracking(feeTrackingData);
    } catch (error) {
      console.error('Error loading fee tracking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHikeFee = async (fee: any, feeType: 'class' | 'transport' | 'custom') => {
    setSelectedFeeForHike({ ...fee, feeType });
    setHikeForm({
      new_amount: fee.amount?.toString() || '',
      effective_from_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowHikeModal(true);
    
    // Load version history
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await loadFeeVersions(token, feeType, fee.id);
      setFeeVersions(data.versions || []);
    } catch (error) {
      console.error('Error loading fee versions:', error);
    }
  };

  const handleSubmitHike = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFeeForHike) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      if (selectedFeeForHike.feeType === 'class') {
        await hikeClassFee(token, selectedFeeForHike.id, {
          new_amount: parseFloat(hikeForm.new_amount),
          effective_from_date: hikeForm.effective_from_date,
          notes: hikeForm.notes
        });
      } else if (selectedFeeForHike.feeType === 'transport') {
        await hikeTransportFee(token, selectedFeeForHike.id, {
          new_amount: parseFloat(hikeForm.new_amount),
          effective_from_date: hikeForm.effective_from_date,
          notes: hikeForm.notes
        });
      } else {
        return; // Custom fees don't support hikes
      }

      alert('Fee hike applied successfully! Future bills will use the new amount.');
      setShowHikeModal(false);
      setSelectedFeeForHike(null);
      setHikeForm({
        new_amount: '',
        effective_from_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      
      // Reload fees
      if (activeTab === 'class-fees') loadClassFees();
      else if (activeTab === 'transport') loadTransportData();
      else if (activeTab === 'custom-fees') loadCustomFees();
      else if (activeTab === 'hikes') {
        // Reload all fee types for hikes tab
        loadClassFees();
        loadTransportData();
        loadCustomFees();
      }
    } catch (error: any) {
      alert(error.message || 'Failed to hike fee');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-2xl font-bold text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Fee Management</h2>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              ...(isClerk ? [] : [
                { id: 'class-fees', label: 'Class Fees' },
                { id: 'custom-fees', label: 'Custom Fees' },
                { id: 'transport', label: 'Transport' },
                { id: 'hikes', label: 'Fee Hikes' },
              ]),
              { id: 'tracking', label: 'Fee Tracking' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Custom Fees Tab - Only for Principal */}
      {activeTab === 'custom-fees' && !isClerk && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Custom Fees</h3>
            {!isClerk && (
              <button
                onClick={() => setShowCustomFeeModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                + Add Custom Fee
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customFees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No custom fees found. Click "Add Custom Fee" to create one.
                    </td>
                  </tr>
                ) : (
                  customFees.map((fee) => (
                    <tr key={fee.id}>
                      <td className="px-6 py-4 font-medium">{fee.class_groups?.name || 'All Classes'}</td>
                      <td className="px-6 py-4">{fee.fee_categories?.name || fee.name || '-'}</td>
                      <td className="px-6 py-4">₹{parseFloat(fee.amount || 0).toFixed(2)}</td>
                      <td className="px-6 py-4">{fee.fee_cycle || '-'}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{fee.effective_from ? new Date(fee.effective_from).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={async () => {
                            if (!confirm('Are you sure you want to delete this custom fee?')) return;
                            try {
                              const token = (await supabase.auth.getSession()).data.session?.access_token;
                              if (!token) return;
                              await deleteCustomFee(token, fee.id);
                              alert('Custom fee deleted successfully!');
                              loadCustomFees();
                            } catch (error: any) {
                              alert(error.message || 'Failed to delete custom fee');
                            }
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Class Fees Tab - Only for Principal */}
      {activeTab === 'class-fees' && !isClerk && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Class Fees</h3>
            {!isClerk && (
              <button
                onClick={() => setShowClassFeeModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                + Add Class Fee
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Day</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {classFees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No class fees found. Click "Add Class Fee" to get started.
                    </td>
                  </tr>
                ) : (
                  classFees.map((fee) => (
                    <tr key={fee.id}>
                      <td className="px-6 py-4">{fee.class_groups?.name || '-'}</td>
                      <td className="px-6 py-4">{fee.name || fee.fee_categories?.name || 'Class Fee'}</td>
                      <td className="px-6 py-4">₹{parseFloat(fee.amount || 0).toLocaleString()}</td>
                      <td className="px-6 py-4">{fee.fee_cycle}</td>
                      <td className="px-6 py-4">{fee.due_day || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button className="text-blue-600 hover:text-blue-800">Edit</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transport Tab - Only for Principal */}
      {activeTab === 'transport' && !isClerk && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Transport Routes</h3>
              {!isClerk && (
                <button
                  onClick={() => setShowRouteModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  + Add Route
                </button>
              )}
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bus Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transportRoutes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No transport routes found.
                      </td>
                    </tr>
                  ) : (
                    transportRoutes.map((route) => (
                      <tr key={route.id}>
                        <td className="px-6 py-4 font-medium">{route.route_name}</td>
                        <td className="px-6 py-4">{route.bus_number || '-'}</td>
                        <td className="px-6 py-4">{route.zone || '-'}</td>
                        <td className="px-6 py-4">{route.distance_km ? `${route.distance_km} km` : '-'}</td>
                        <td className="px-6 py-4">
                          <button className="text-blue-600 hover:text-blue-800">Edit</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Transport Fees</h3>
              {!isClerk && (
                <button
                  onClick={() => setShowTransportFeeModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  + Add Transport Fee
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Fee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Escort Fee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuel Surcharge</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transportFees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        No transport fees found.
                      </td>
                    </tr>
                  ) : (
                    transportFees.map((fee) => (
                      <tr key={fee.id}>
                        <td className="px-6 py-4">{fee.transport_routes?.route_name || '-'}</td>
                        <td className="px-6 py-4">₹{parseFloat(fee.base_fee || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">₹{parseFloat(fee.escort_fee || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">₹{parseFloat(fee.fuel_surcharge || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">{fee.fee_cycle}</td>
                        <td className="px-6 py-4">
                          <button className="text-blue-600 hover:text-blue-800">Edit</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Optional Fees, Custom Fees, Bills - REMOVED */}

      {/* Fee Tracking Tab */}
      {activeTab === 'tracking' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Fee Collection Tracking</h3>
            <div className="flex gap-4">
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="">All Classes</option>
                {classGroups.map((cg) => (
                  <option key={cg.id} value={cg.id}>
                    {cg.name}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partially Paid</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Assigned</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Paid</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transport Fee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {feeTracking
                  .filter((track: any) => {
                    if (filterClass && track.student?.class_group_id !== filterClass) return false;
                    if (filterStatus === 'paid' && track.pending_amount > 0) return false;
                    if (filterStatus === 'pending' && track.pending_amount === 0) return false;
                    if (filterStatus === 'partial' && (track.pending_amount === 0 || track.total_paid === 0)) return false;
                    return true;
                  })
                  .length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                      No fee tracking data found.
                    </td>
                  </tr>
                ) : (
                  feeTracking
                    .filter((track: any) => {
                      if (filterClass && track.student?.class_group_id !== filterClass) return false;
                      if (filterStatus === 'paid' && track.pending_amount > 0) return false;
                      if (filterStatus === 'pending' && track.pending_amount === 0) return false;
                      if (filterStatus === 'partial' && (track.pending_amount === 0 || track.total_paid === 0)) return false;
                      return true;
                    })
                    .map((track: any) => (
                      <tr key={track.student?.id}>
                        <td className="px-6 py-4 font-medium">{track.student?.profile?.full_name || '-'}</td>
                        <td className="px-6 py-4">{track.student?.roll_number || '-'}</td>
                        <td className="px-6 py-4">{track.student?.class_groups?.name || '-'}</td>
                        <td className="px-6 py-4 text-right font-semibold">₹{parseFloat(track.total_assigned || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-green-600">₹{parseFloat(track.total_paid || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-semibold text-red-600">₹{parseFloat(track.pending_amount || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">₹{parseFloat(track.transport_amount || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            track.pending_amount === 0 ? 'bg-green-100 text-green-800' :
                            track.total_paid > 0 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {track.pending_amount === 0 ? 'Paid' : track.total_paid > 0 ? 'Partial' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setSelectedTrackingStudent(track);
                            }}
                            className="text-blue-600 hover:text-blue-800 mr-2"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Fee Details Modal (from Tracking) */}
      {selectedTrackingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">Fee Details - {selectedTrackingStudent.student?.profile?.full_name}</h3>
              <button
                onClick={() => setSelectedTrackingStudent(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-bold mb-3">Fee Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Assigned</p>
                    <p className="text-xl font-semibold">₹{parseFloat(selectedTrackingStudent.total_assigned || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Paid</p>
                    <p className="text-xl font-semibold text-green-600">₹{parseFloat(selectedTrackingStudent.total_paid || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-xl font-semibold text-red-600">₹{parseFloat(selectedTrackingStudent.pending_amount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Transport Fee</p>
                    <p className="text-xl font-semibold">₹{parseFloat(selectedTrackingStudent.transport_amount || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Payments Tab - REMOVED */}

      {/* Modals will be added here - I'll create a simplified version with key modals */}
      {/* Class Fee Modal */}
      {showClassFeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Add Class Fee</h3>
            <form onSubmit={handleSaveClassFee}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Class *</label>
                  <select
                    value={classFeeForm.class_group_id}
                    onChange={(e) => setClassFeeForm({ ...classFeeForm, class_group_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  >
                    <option value="">Select Class</option>
                    {classGroups.map((classGroup) => (
                      <option key={classGroup.id} value={classGroup.id}>
                        {classGroup.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fee Name *</label>
                  <input
                    type="text"
                    value={classFeeForm.name}
                    onChange={(e) => setClassFeeForm({ ...classFeeForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="e.g., Tuition Fee, Development Fee"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={classFeeForm.amount}
                    onChange={(e) => setClassFeeForm({ ...classFeeForm, amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fee Cycle *</label>
                  <select
                    value={classFeeForm.fee_cycle}
                    onChange={(e) => setClassFeeForm({ ...classFeeForm, fee_cycle: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  >
                    <option value="one-time">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                {classFeeForm.fee_cycle !== 'one-time' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Due Day (1-31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={classFeeForm.due_day}
                      onChange={(e) => setClassFeeForm({ ...classFeeForm, due_day: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <textarea
                    value={classFeeForm.notes}
                    onChange={(e) => setClassFeeForm({ ...classFeeForm, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowClassFeeModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Fee Modal */}
      {showCustomFeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Add Custom Fee</h3>
            <form onSubmit={handleSaveCustomFee}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Class</label>
                  <select
                    value={customFeeForm.class_group_id}
                    onChange={(e) => setCustomFeeForm({ ...customFeeForm, class_group_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  >
                    <option value="">All Classes</option>
                    {classGroups.map((classGroup) => (
                      <option key={classGroup.id} value={classGroup.id}>
                        {classGroup.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Select "All Classes" to apply this fee to all classes, or select a specific class</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Custom Fee Name *</label>
                  <input
                    type="text"
                    value={customFeeForm.name}
                    onChange={(e) => setCustomFeeForm({ ...customFeeForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="e.g., Library Fee, Lab Fee, Sports Fee"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customFeeForm.amount}
                    onChange={(e) => setCustomFeeForm({ ...customFeeForm, amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fee Cycle *</label>
                  <select
                    value={customFeeForm.fee_cycle}
                    onChange={(e) => setCustomFeeForm({ ...customFeeForm, fee_cycle: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  >
                    <option value="one-time">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomFeeModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transport Route Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Add Transport Route</h3>
            <form onSubmit={handleSaveRoute}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Route Name *</label>
                  <input
                    type="text"
                    value={routeForm.route_name}
                    onChange={(e) => setRouteForm({ ...routeForm, route_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="e.g., Route A, North Zone"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Bus Number</label>
                  <input
                    type="text"
                    value={routeForm.bus_number}
                    onChange={(e) => setRouteForm({ ...routeForm, bus_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="e.g., BUS-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Zone</label>
                  <input
                    type="text"
                    value={routeForm.zone}
                    onChange={(e) => setRouteForm({ ...routeForm, zone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="e.g., North, South, East, West"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Distance (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={routeForm.distance_km}
                    onChange={(e) => setRouteForm({ ...routeForm, distance_km: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={routeForm.description}
                    onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowRouteModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transport Fee Modal */}
      {showTransportFeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h3 className="text-xl font-bold mb-4">Add Transport Fee</h3>
            <form onSubmit={handleSaveTransportFee}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Route *</label>
                  <select
                    value={transportFeeForm.route_id}
                    onChange={(e) => setTransportFeeForm({ ...transportFeeForm, route_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  >
                    <option value="">Select Route</option>
                    {transportRoutes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.route_name} {route.bus_number ? `(${route.bus_number})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Base Fee (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transportFeeForm.base_fee}
                    onChange={(e) => setTransportFeeForm({ ...transportFeeForm, base_fee: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Escort Fee (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={transportFeeForm.escort_fee}
                      onChange={(e) => setTransportFeeForm({ ...transportFeeForm, escort_fee: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Fuel Surcharge (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={transportFeeForm.fuel_surcharge}
                      onChange={(e) => setTransportFeeForm({ ...transportFeeForm, fuel_surcharge: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fee Cycle *</label>
                  <select
                    value={transportFeeForm.fee_cycle}
                    onChange={(e) => setTransportFeeForm({ ...transportFeeForm, fee_cycle: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  >
                    <option value="monthly">Monthly</option>
                    <option value="per-trip">Per Trip</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                {transportFeeForm.fee_cycle !== 'per-trip' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Due Day (1-31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={transportFeeForm.due_day}
                      onChange={(e) => setTransportFeeForm({ ...transportFeeForm, due_day: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <textarea
                    value={transportFeeForm.notes}
                    onChange={(e) => setTransportFeeForm({ ...transportFeeForm, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowTransportFeeModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Optional Fee Modal - REMOVED */}

      {/* Custom Fee Modal - REMOVED */}

      {/* Generate Bill Modal - REMOVED */}

      {/* Payment Modal - REMOVED */}
      {/* Bill Detail Modal - REMOVED */}

      {/* Fee Hikes Tab - Only for Principal */}
      {activeTab === 'hikes' && !isClerk && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">Fee Hikes & Version History</h3>
          <p className="text-gray-600 mb-6">
            Increase or decrease fees for future billing periods. Past bills remain unchanged.
          </p>

          {/* Class Fees Section */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold mb-4">Class Fees</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {classFees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No class fees found.
                      </td>
                    </tr>
                  ) : (
                    classFees.map((fee) => (
                      <tr key={fee.id}>
                        <td className="px-6 py-4">{fee.class_groups?.name || '-'}</td>
                        <td className="px-6 py-4">{fee.name || fee.fee_categories?.name || 'Class Fee'}</td>
                        <td className="px-6 py-4">₹{parseFloat(fee.amount || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">{fee.fee_cycle}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleHikeFee(fee, 'class')}
                            className="text-blue-600 hover:text-blue-800 mr-4"
                          >
                            Hike Fee
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transport Fees Section */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold mb-4">Transport Fees</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transportFees.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        No transport fees found.
                      </td>
                    </tr>
                  ) : (
                    transportFees.map((fee) => {
                      const totalAmount = parseFloat(fee.base_fee || 0) + 
                                         parseFloat(fee.escort_fee || 0) + 
                                         parseFloat(fee.fuel_surcharge || 0);
                      return (
                        <tr key={fee.id}>
                          <td className="px-6 py-4">{fee.transport_routes?.route_name || '-'}</td>
                          <td className="px-6 py-4">₹{totalAmount.toLocaleString()}</td>
                          <td className="px-6 py-4">{fee.fee_cycle}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleHikeFee({ ...fee, amount: totalAmount }, 'transport')}
                              className="text-blue-600 hover:text-blue-800 mr-4"
                            >
                              Hike Fee
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Custom Fees Section */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold mb-4">Custom Fees</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customFees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No custom fees found.
                      </td>
                    </tr>
                  ) : (
                    customFees.map((fee) => (
                      <tr key={fee.id}>
                        <td className="px-6 py-4">{fee.class_groups?.name || 'All Classes'}</td>
                        <td className="px-6 py-4">{fee.fee_categories?.name || fee.name || '-'}</td>
                        <td className="px-6 py-4">₹{parseFloat(fee.amount || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">{fee.fee_cycle || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleHikeFee(fee, 'custom')}
                            className="text-blue-600 hover:text-blue-800 mr-4"
                          >
                            Hike Fee
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Fee Hike Modal */}
      {showHikeModal && selectedFeeForHike && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Hike Fee</h3>
            <form onSubmit={handleSubmitHike}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Amount
                </label>
                <input
                  type="text"
                  value={selectedFeeForHike.amount || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={hikeForm.new_amount}
                  onChange={(e) => setHikeForm({ ...hikeForm, new_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Effective From Date *
                </label>
                <input
                  type="date"
                  required
                  value={hikeForm.effective_from_date}
                  onChange={(e) => setHikeForm({ ...hikeForm, effective_from_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Bills generated after this date will use the new amount. Past bills remain unchanged.
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={hikeForm.notes}
                  onChange={(e) => setHikeForm({ ...hikeForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                />
              </div>

              {/* Version History */}
              {feeVersions.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Version History
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                    {feeVersions.map((version: any, idx: number) => (
                      <div key={version.id} className="text-xs mb-2 pb-2 border-b last:border-0">
                        <div className="flex justify-between">
                          <span className="font-medium">Version {version.version_number}</span>
                          <span>₹{parseFloat(version.amount || 0).toLocaleString()}</span>
                        </div>
                        <div className="text-gray-500">
                          {new Date(version.effective_from_date).toLocaleDateString()} -{' '}
                          {version.effective_to_date 
                            ? new Date(version.effective_to_date).toLocaleDateString()
                            : 'Active'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowHikeModal(false);
                    setSelectedFeeForHike(null);
                    setFeeVersions([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply Fee Hike
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
