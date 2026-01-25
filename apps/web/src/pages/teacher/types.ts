export interface Assignment {
  id: string;
  class_group_id: string;
  subject_id: string;
  section_id: string | null;
  class_groups: {
    id: string;
    name: string;
    description: string | null;
  };
  subjects: {
    id: string;
    name: string;
    code: string | null;
  };
  sections: {
    id: string;
    name: string;
  } | null;
}

export interface Student {
  id: string;
  roll_number: string | null;
  profile: {
    id: string;
    full_name: string;
    email: string;
  };
  section_name: string | null;
}
