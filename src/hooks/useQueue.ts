import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

export interface QueueEntry {
  id: string;
  session_id?: string;
  phone: string;
  patient_name?: string;
  state: 'U' | 'N' | 'R';
  doctor_id: string;
  state_number: number;
  client_id: string;
  position: number;
  status: 'waiting' | 'in_cabinet' | 'completed';
  appointment_id?: string;
  created_at: string;
  doctor?: { name: string; initial: string };
}

export interface Doctor {
  id: string;
  name: string;
  initial: string;
}

export function useQueue() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [inCabinetEntries, setInCabinetEntries] = useState<QueueEntry[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  const removeEntryFromState = useCallback((entryId: string) => {
    setEntries(prev => prev.filter(e => e.id !== entryId));
    setInCabinetEntries(prev => prev.filter(e => e.id !== entryId));
  }, []);

  const isQueueEntryCompletionConflict = (error: { code?: string; message?: string; details?: string; hint?: string } | null) => {
    if (!error || (error.code !== '23503' && error.code !== '23505')) {
      return false;
    }

    const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
    return text.includes('queue_entry_id') || text.includes('completed_clients_queue_entry_id_fkey');
  };

  const fetchDoctors = useCallback(async () => {
    const { data } = await supabase.from('doctors').select('*');
    if (data) setDoctors(data);
  }, []);

  const fetchEntries = useCallback(async () => {
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();

    const { data } = await supabase
      .from('queue_entries')
      .select('*, doctor:doctors(*)')
      .eq('status', 'waiting')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
      .order('created_at', { ascending: true });
    if (data) {
      const sorted = sortByPriority(data as QueueEntry[]);
      setEntries(sorted);
    }
  }, []);

  const fetchInCabinetEntries = useCallback(async () => {
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();

    const { data } = await supabase
      .from('queue_entries')
      .select('*, doctor:doctors(*)')
      .eq('status', 'in_cabinet')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
      .order('created_at', { ascending: true });
    if (data) {
      setInCabinetEntries(data as QueueEntry[]);
    }
  }, []);

  const sortByPriority = (items: QueueEntry[]) => {
    return [...items].sort((a, b) => {
      // 1. U (Urgent) always has absolute priority
      if (a.state === 'U' && b.state !== 'U') return -1;
      if (a.state !== 'U' && b.state === 'U') return 1;
      if (a.state === 'U' && b.state === 'U') return a.state_number - b.state_number;

      // 2. For N (New) and R (Appointment), alternate: N1, R1, N2, R2, ...
      const getRank = (e: QueueEntry) => {
        const num = e.state_number || 0;
        if (e.state === 'N') return num * 2 - 1; // N1->1, N2->3, N3->5
        if (e.state === 'R') return num * 2;     // R1->2, R2->4, R3->6
        return 999;
      };

      const rankA = getRank(a);
      const rankB = getRank(b);

      if (rankA !== rankB) return rankA - rankB;

      // Secondary sort for items with same rank (different doctors) or unknown states
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      // Batch initial fetches
      const docRes = await supabase.from('doctors').select('*');

      // Seed default teams if needed
      if (!docRes.data || docRes.data.length === 0) {
        try {
          const defaultDoctors = [
            { name: 'Djihane', initial: 'D' },
            { name: 'Zineb', initial: 'Z' },
            { name: 'Imane', initial: 'I' },
          ];
          const insertRes = await supabase.from('doctors').insert(defaultDoctors).select('*');
          if (insertRes.data) setDoctors(insertRes.data as Doctor[]);
        } catch (err) {
          if (docRes.data) setDoctors(docRes.data);
        }
      } else {
        setDoctors(docRes.data);
      }

      await Promise.all([
        fetchEntries(),
        fetchInCabinetEntries()
      ]);
      setLoading(false);
    };
    init();
  }, [fetchEntries, fetchInCabinetEntries]);

  // Combined Real-time subscription
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const channel = supabase
      .channel('queue-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
        },
        () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            fetchEntries();
            fetchInCabinetEntries();
          }, 300);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [fetchEntries, fetchInCabinetEntries]);

  const callClient = async (entryId: string) => {
    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'in_cabinet' })
      .eq('id', entryId);

    if (!error) {
      fetchEntries();
      fetchInCabinetEntries();
    }
    return { error };
  };

  const addClient = async (phone: string, state: 'U' | 'N' | 'R', doctorId: string, patientName?: string, appointmentId?: string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor) return { error: new Error('Equipe introuvable') };

    const todayStart = startOfDay(new Date()).toISOString();

    // Get next number for today
    const [qRes, cRes] = await Promise.all([
      supabase
        .from('queue_entries')
        .select('state_number')
        .eq('state', state)
        .gte('created_at', todayStart)
        .order('state_number', { ascending: false })
        .limit(1),
      supabase
        .from('completed_clients')
        .select('client_id')
        .eq('state', state)
        .gte('completed_at', todayStart)
    ]);

    let maxNumber = 0;
    if (qRes.data && qRes.data.length > 0) {
      maxNumber = qRes.data[0].state_number;
    }
    if (cRes.data && cRes.data.length > 0) {
      cRes.data.forEach(item => {
        const matches = item.client_id.match(/\d+/);
        if (matches) {
          const num = parseInt(matches[0]);
          if (num > maxNumber) maxNumber = num;
        }
      });
    }

    const nextNumber = maxNumber + 1;
    const clientId = `${state}${nextNumber}${doctor.initial}`;
    const position = entries.length + 1;

    const { data, error } = await supabase
      .from('queue_entries')
      .insert({
        phone: phone.trim(),
        patient_name: patientName?.trim(),
        client_name: patientName?.trim(), // Added to match potential DB requirement
        state,
        doctor_id: doctorId,
        state_number: nextNumber,
        client_id: clientId,
        position,
        appointment_id: appointmentId,
      } as any)
      .select('*, doctor:doctors(*)')
      .single();

    if (appointmentId) {
      await supabase.from('appointments').update({ status: 'coming' }).eq('id', appointmentId);
    }

    if (data && !error) {
      setEntries(prev => sortByPriority([...prev, data as QueueEntry]));
    }

    return { data, error };
  };

  const completeClient = async (
    entryId: string,
    clientName: string,
    treatment: string,
    totalAmount: number,
    tranchePaid: number,
    receptionistId: string,
    notes?: string
  ) => {
    const entry = entries.find(e => e.id === entryId) || inCabinetEntries.find(e => e.id === entryId);
    if (!entry) return { error: new Error('Entrée introuvable') };

    const todayStart = startOfDay(new Date()).toISOString();

    // Check if already completed today
    const { data: existing } = await supabase
      .from('completed_clients')
      .select('id')
      .eq('client_id', entry.client_id)
      .eq('phone', entry.phone)
      .gte('completed_at', todayStart)
      .maybeSingle() as any;

    if (existing) {
      await supabase.from('queue_entries').delete().eq('id', entryId);
      removeEntryFromState(entryId);
      return { error: null, alreadyCompleted: true };
    }

    const insertData: any = {
      client_name: clientName.trim(),
      phone: entry.phone,
      doctor_id: entry.doctor_id,
      client_id: entry.client_id,
      state: entry.state,
      treatment,
      total_amount: totalAmount,
      tranche_paid: tranchePaid,
      receptionist_id: receptionistId,
      notes: notes?.trim() || null,
    };

    let { error: insertError } = await supabase.from('completed_clients').insert(insertData);

    if (insertError && insertError.code === '23503' && insertError.message?.includes('receptionist_id')) {
      insertData.receptionist_id = 'a44e7e83-189f-4f82-96d8-b0eeea4ab104';
      const retry = await supabase.from('completed_clients').insert(insertData);
      insertError = retry.error;
    }

    if (insertError) {
      if (insertError.code === '23505' || isQueueEntryCompletionConflict(insertError)) {
        await supabase.from('queue_entries').delete().eq('id', entryId);
        removeEntryFromState(entryId);
        return { error: null, alreadyCompleted: true };
      }
      return { error: insertError, alreadyCompleted: false };
    }

    if (entry.appointment_id) {
      await supabase.from('appointments').update({ status: 'attended' }).eq('id', entry.appointment_id);
    }

    await supabase.from('queue_entries').delete().eq('id', entryId);
    removeEntryFromState(entryId);

    return { error: null, alreadyCompleted: false };
  };

  const getStats = () => {
    const stats = { U: { current: 0, total: 0 }, N: { current: 0, total: 0 }, R: { current: 0, total: 0 } };
    const waiting = entries.filter(e => e.status === 'waiting');

    (['U', 'N', 'R'] as const).forEach(state => {
      const stateEntries = waiting.filter(e => e.state === state);
      stats[state].current = stateEntries.length > 0 ? stateEntries[0].state_number : 0;
      stats[state].total = stateEntries.length;
    });

    return stats;
  };

  const updateClient = async (entryId: string, updates: { phone?: string; state?: 'U' | 'N' | 'R'; doctor_id?: string; patient_name?: string }) => {
    const { error } = await supabase.from('queue_entries').update(updates).eq('id', entryId);
    if (!error) {
      fetchEntries();
      fetchInCabinetEntries();
    }
    return { error };
  };

  const deleteClient = async (entryId: string) => {
    const { error } = await supabase.from('queue_entries').delete().eq('id', entryId);
    if (!error) {
      setEntries(prev => prev.filter(e => e.id !== entryId));
      setInCabinetEntries(prev => prev.filter(e => e.id !== entryId));
    }
    return { error };
  };

  const updateCompletedClient = async (id: string, updates: any) => {
    const { error } = await supabase.from('completed_clients').update(updates).eq('id', id);
    return { error };
  };

  const deleteCompletedClient = async (id: string) => {
    const { error } = await supabase.from('completed_clients').delete().eq('id', id);
    return { error };
  };

  return {
    entries,
    inCabinetEntries,
    doctors,
    loading,
    addClient,
    callClient,
    completeClient,
    getStats,
    fetchEntries,
    fetchInCabinetEntries,
    updateClient,
    deleteClient,
    updateCompletedClient,
    deleteCompletedClient,
  };
}
