import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';

// Current cycle's distribution + who finished, for organizer screens
export function useCycleStatus(khatmaId) {
  const [state, setState] = useState({ dash: null, completions: null, loading: true, error: '' });

  const reload = useCallback(async () => {
    try {
      const dash = await api.getDashboard(khatmaId);
      const completions = await api.getCompletions(khatmaId, dash.cycleNumber);
      setState({ dash, completions, loading: false, error: '' });
    } catch (err) {
      // keep previous dash/completions so a failed reload doesn't blank the screen
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, [khatmaId]);

  useEffect(() => { reload(); }, [reload]);

  return { ...state, reload };
}
