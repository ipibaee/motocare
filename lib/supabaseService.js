// lib/supabaseService.js
// CRUD helper with localStorage fallback

const isSupabaseConfigured = () => {
  return window.supabaseClient !== null;
};

const supabaseService = {
  // --- VEHICLES ---
  async getVehicles(userId) {
    if (isSupabaseConfigured() && userId) {
      const { data, error } = await window.supabaseClient
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error) return data;
      console.error("Supabase getVehicles error:", error);
    }
    // Fallback
    const saved = localStorage.getItem('motocare_vehicles');
    return saved ? JSON.parse(saved) : [
      { id: 'nmax-new', name: 'Nmax New', brand: 'Yamaha', type: 'Maxi', year: '2022', plate: 'B 1234 SSS', odo: 58000, initialOdo: 0 },
      { id: 'beat-deluxe', name: 'Beat Deluxe', brand: 'Honda', type: 'Matic', year: '2021', plate: 'D 5678 XXX', odo: 12000, initialOdo: 0 }
    ];
  },

  async saveVehicle(userId, vehicle) {
    if (isSupabaseConfigured() && userId) {
      const dbVehicle = {
        name: vehicle.name,
        brand: vehicle.brand,
        type: vehicle.type,
        year: parseInt(vehicle.year, 10),
        plate_number: vehicle.plate || vehicle.plate_number,
        current_odometer: parseInt(vehicle.odo || vehicle.current_odometer, 10) || 0,
        user_id: userId
      };

      if (vehicle.id && !vehicle.id.startsWith('v_') && vehicle.id !== 'nmax-new' && vehicle.id !== 'beat-deluxe') {
        // Update
        const { data, error } = await window.supabaseClient
          .from('vehicles')
          .update(dbVehicle)
          .eq('id', vehicle.id)
          .select();
        if (!error) return data[0];
        console.error("Supabase updateVehicle error:", error);
      } else {
        // Insert (generate new UUID or let Supabase do it)
        const { data, error } = await window.supabaseClient
          .from('vehicles')
          .insert([dbVehicle])
          .select();
        if (!error) return data[0];
        console.error("Supabase insertVehicle error:", error);
      }
    }
    // Fallback
    return vehicle;
  },

  async deleteVehicle(userId, vehicleId) {
    if (isSupabaseConfigured() && userId && !vehicleId.startsWith('v_') && vehicleId !== 'nmax-new' && vehicleId !== 'beat-deluxe') {
      const { error } = await window.supabaseClient
        .from('vehicles')
        .delete()
        .eq('id', vehicleId);
      if (error) console.error("Supabase deleteVehicle error:", error);
    }
  },

  // --- COMPONENTS ---
  async getComponents(userId, vehicleId) {
    if (isSupabaseConfigured() && userId && vehicleId && !vehicleId.startsWith('v_') && vehicleId !== 'nmax-new' && vehicleId !== 'beat-deluxe') {
      const { data, error } = await window.supabaseClient
        .from('components')
        .select('*')
        .eq('vehicle_id', vehicleId);
      if (!error) {
        return data.map(c => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          intervalKm: c.interval_km,
          intervalMonths: c.interval_month,
          lastServiceOdo: c.last_service_odometer,
          lastServiceDate: c.last_service_date,
          warning: c.notes || 'Perlu servis berkala.',
          advice: c.notes || 'Cek kondisi secara rutin.'
        }));
      }
      console.error("Supabase getComponents error:", error);
    }
    // Fallback
    const saved = localStorage.getItem('motocare_components');
    const allComps = saved ? JSON.parse(saved) : {};
    return allComps[vehicleId] || [];
  },

  async saveComponent(userId, vehicleId, component) {
    if (isSupabaseConfigured() && userId && vehicleId && !vehicleId.startsWith('v_') && vehicleId !== 'nmax-new' && vehicleId !== 'beat-deluxe') {
      const dbComp = {
        user_id: userId,
        vehicle_id: vehicleId,
        name: component.name,
        icon: component.icon,
        interval_km: parseInt(component.intervalKm || component.interval_km, 10),
        interval_month: parseInt(component.intervalMonths || component.interval_month, 10),
        last_service_date: component.lastServiceDate || component.last_service_date,
        last_service_odometer: parseInt(component.lastServiceOdo || component.last_service_odometer, 10),
        is_urgent: component.isUrgent || component.is_urgent || false,
        notes: component.advice || component.notes || ''
      };

      if (component.id && !component.id.startsWith('c_')) {
        // Update
        const { data, error } = await window.supabaseClient
          .from('components')
          .update(dbComp)
          .eq('id', component.id)
          .select();
        if (!error) return data[0];
        console.error("Supabase updateComponent error:", error);
      } else {
        // Insert
        const { data, error } = await window.supabaseClient
          .from('components')
          .insert([dbComp])
          .select();
        if (!error) return data[0];
        console.error("Supabase insertComponent error:", error);
      }
    }
    return component;
  },

  async deleteComponent(userId, vehicleId, componentId) {
    if (isSupabaseConfigured() && userId && !componentId.startsWith('c_')) {
      const { error } = await window.supabaseClient
        .from('components')
        .delete()
        .eq('id', componentId);
      if (error) console.error("Supabase deleteComponent error:", error);
    }
  },

  // --- SERVICE LOGS ---
  async getServiceLogs(userId, vehicleId) {
    if (isSupabaseConfigured() && userId && vehicleId && !vehicleId.startsWith('v_') && vehicleId !== 'nmax-new' && vehicleId !== 'beat-deluxe') {
      const { data, error } = await window.supabaseClient
        .from('service_logs')
        .select(`
          *,
          service_log_items (*)
        `)
        .eq('vehicle_id', vehicleId)
        .order('service_date', { ascending: false });
      if (!error) {
        return data.map(log => ({
          id: log.id,
          vehicleId: log.vehicle_id,
          date: log.service_date,
          odo: log.odometer,
          components: log.service_log_items.map(item => item.component_name),
          notes: log.notes,
          cost: parseFloat(log.total_cost) || 0
        }));
      }
      console.error("Supabase getServiceLogs error:", error);
    }
    // Fallback
    const saved = localStorage.getItem('motocare_history');
    const list = saved ? JSON.parse(saved) : [];
    return list.filter(h => h.vehicleId === vehicleId);
  },

  async saveServiceLog(userId, vehicleId, log) {
    if (isSupabaseConfigured() && userId && vehicleId && !vehicleId.startsWith('v_') && vehicleId !== 'nmax-new' && vehicleId !== 'beat-deluxe') {
      const dbLog = {
        user_id: userId,
        vehicle_id: vehicleId,
        service_date: log.date,
        odometer: parseInt(log.odo, 10),
        total_cost: parseFloat(log.cost) || 0,
        notes: log.notes || '',
        receipt_url: log.receipt_url || ''
      };

      const { data, error } = await window.supabaseClient
        .from('service_logs')
        .insert([dbLog])
        .select();

      if (!error && data && data.length > 0) {
        const savedLog = data[0];
        // Insert items
        if (log.components && log.components.length > 0) {
          const dbItems = log.components.map(compName => ({
            service_log_id: savedLog.id,
            component_name: compName,
            cost: 0 // details cost per component (simplified)
          }));
          await window.supabaseClient.from('service_log_items').insert(dbItems);
        }
        return savedLog;
      }
      console.error("Supabase saveServiceLog error:", error);
    }
    return log;
  },

  // --- SHOPS ---
  async getShops(userId) {
    if (isSupabaseConfigured() && userId) {
      const { data, error } = await window.supabaseClient
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) return data;
      console.error("Supabase getShops error:", error);
    }
    // Fallback
    const saved = localStorage.getItem('motocare_shops');
    return saved ? JSON.parse(saved) : [];
  },

  async saveShop(userId, shop) {
    if (isSupabaseConfigured() && userId) {
      const dbShop = {
        user_id: userId,
        name: shop.name,
        address: shop.address || '',
        phone: shop.phone || '',
        rating: parseFloat(shop.rating) || 4.5,
        notes: shop.notes || ''
      };

      if (shop.id && !shop.id.startsWith('s_') && !shop.id.startsWith('custom_')) {
        const { data, error } = await window.supabaseClient
          .from('shops')
          .update(dbShop)
          .eq('id', shop.id)
          .select();
        if (!error) return data[0];
      } else {
        const { data, error } = await window.supabaseClient
          .from('shops')
          .insert([dbShop])
          .select();
        if (!error) return data[0];
      }
    }
    return shop;
  },

  async deleteShop(userId, shopId) {
    if (isSupabaseConfigured() && userId && !shopId.startsWith('s_') && !shopId.startsWith('custom_')) {
      await window.supabaseClient
        .from('shops')
        .delete()
        .eq('id', shopId);
    }
  },

  // --- DATA MIGRATION ---
  async migrateLocalDataToSupabase(userId) {
    if (!isSupabaseConfigured() || !userId) return false;
    try {
      console.log('Migrating local storage data to Supabase...');
      // 1. Migrate vehicles
      const localVehicles = JSON.parse(localStorage.getItem('motocare_vehicles') || '[]');
      const localComps = JSON.parse(localStorage.getItem('motocare_components') || '{}');
      const localHistory = JSON.parse(localStorage.getItem('motocare_history') || '[]');
      const localShops = JSON.parse(localStorage.getItem('motocare_shops') || '[]');

      for (const v of localVehicles) {
        // Skip dummy placeholders or migrate them with new IDs
        const originalId = v.id;
        const dbVehicle = {
          name: v.name,
          brand: v.brand,
          type: v.type,
          year: parseInt(v.year, 10) || 2022,
          plate_number: v.plate || '',
          current_odometer: parseInt(v.odo, 10) || 0,
          user_id: userId
        };
        
        const { data: vData, error: vErr } = await window.supabaseClient
          .from('vehicles')
          .insert([dbVehicle])
          .select();
        
        if (!vErr && vData && vData.length > 0) {
          const newVehicleId = vData[0].id;
          
          // Migrate components for this vehicle
          const comps = localComps[originalId] || [];
          for (const c of comps) {
            const dbComp = {
              user_id: userId,
              vehicle_id: newVehicleId,
              name: c.name,
              icon: c.icon,
              interval_km: parseInt(c.intervalKm, 10) || 5000,
              interval_month: parseInt(c.intervalMonths, 10) || 6,
              last_service_date: c.lastServiceDate || '2026-01-01',
              last_service_odometer: parseInt(c.lastServiceOdo, 10) || 0,
              is_urgent: c.isUrgent || false,
              notes: c.advice || ''
            };
            const { data: cData, error: cErr } = await window.supabaseClient
              .from('components')
              .insert([dbComp])
              .select();

            // Migrate history matching this component and vehicle
            if (!cErr && cData && cData.length > 0) {
              const newComponentId = cData[0].id;
              // find logs for this vehicle
              const logs = localHistory.filter(h => h.vehicleId === originalId && h.components.includes(c.name));
              for (const log of logs) {
                // insert service log (avoid inserting duplicates by checking if already done in loop)
                // for simplicity, we can do it component-wise or log-wise.
              }
            }
          }

          // Migrate logs directly
          const vehicleLogs = localHistory.filter(h => h.vehicleId === originalId);
          for (const h of vehicleLogs) {
            const dbLog = {
              user_id: userId,
              vehicle_id: newVehicleId,
              service_date: h.date || '2026-01-01',
              odometer: parseInt(h.odo, 10) || 0,
              total_cost: parseFloat(h.cost) || 0,
              notes: h.notes || ''
            };
            const { data: logData, error: logErr } = await window.supabaseClient
              .from('service_logs')
              .insert([dbLog])
              .select();
            if (!logErr && logData && logData.length > 0) {
              const newLogId = logData[0].id;
              if (h.components && h.components.length > 0) {
                const dbItems = h.components.map(cName => ({
                  service_log_id: newLogId,
                  component_name: cName,
                  cost: 0
                }));
                await window.supabaseClient.from('service_log_items').insert(dbItems);
              }
            }
          }
        }
      }

      // Migrate shops
      for (const s of localShops) {
        const dbShop = {
          user_id: userId,
          name: s.name,
          address: s.address || '',
          phone: s.phone || '',
          rating: parseFloat(s.rating) || 4.5,
          notes: s.notes || ''
        };
        await window.supabaseClient.from('shops').insert([dbShop]);
      }

      console.log('Migration completed successfully!');
      return true;
    } catch (e) {
      console.error('Migration failed:', e);
      return false;
    }
  }
};

window.supabaseService = supabaseService;
