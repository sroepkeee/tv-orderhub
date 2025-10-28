import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MentionUser {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
}

export const useMentionUsers = () => {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, department')
      .order('full_name');

    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const searchUsers = (query: string): MentionUser[] => {
    if (!query) return users;
    
    const lowerQuery = query.toLowerCase();
    return users.filter(user => 
      user.full_name?.toLowerCase().includes(lowerQuery) ||
      user.email?.toLowerCase().includes(lowerQuery) ||
      user.department?.toLowerCase().includes(lowerQuery)
    );
  };

  return { users, loading, searchUsers };
};
