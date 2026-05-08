/**
 * Ported from erpnext/setup/doctype/department/department.py
 * Pure validation logic for Department master.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error: any)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DepartmentDoc {
  name?: string;
  department_name: string;
  company: string;
  parent_department?: string | null;
  is_group?: boolean;
  disabled?: boolean;
  old_parent?: string | null;
  lft?: number;
  rgt?: number;
}

export interface DepartmentTreeNode {
  value: string;
  title: string;
  expandable: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Build abbreviated department name: "Department Name - COMPANY-ABBR". */
export function getAbbreviatedName(name: string, companyAbbr: string): string {
  return `${name} - ${companyAbbr}`;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

/** Validate department and infer root parent when missing.
 *  Returns updated fields or error.
 */
export function validateDepartment(
  doc: DepartmentDoc,
  rootDepartmentName: string | null
): { parent_department?: string | null; error?: string } {
  if (!doc.parent_department) {
    if (rootDepartmentName) {
      return { parent_department: rootDepartmentName };
    }
  }
  return {};
}

/** Validate rename consistency: ensure company abbreviation is present. */
export function validateRename(
  newName: string,
  companyAbbr: string
): string {
  if (!newName.includes(companyAbbr)) {
    return getAbbreviatedName(newName, companyAbbr);
  }
  return newName;
}

/* ------------------------------------------------------------------ */
/*  Tree helpers                                                       */
/* ------------------------------------------------------------------ */

/** Build department tree children for a given parent. */
export function getDepartmentTreeChildren(
  departments: {
    name: string;
    department_name: string;
    parent_department: string | null;
    company: string;
    is_group: boolean;
    disabled: boolean;
  }[],
  parent: string | null,
  company: string | null,
  isRoot: boolean,
  includeDisabled: boolean
): DepartmentTreeNode[] {
  let filtered = includeDisabled ? departments : departments.filter((d) => !d.disabled);

  if (isRoot && company && parent === company) {
    // Return root departments for this company
    filtered = filtered.filter((d) => !d.parent_department || d.parent_department === "");
  } else if (company) {
    filtered = filtered.filter(
      (d) => d.parent_department === parent && d.company === company
    );
  } else {
    filtered = filtered.filter((d) => d.parent_department === parent);
  }

  return filtered.map((d) => ({
    value: d.name,
    title: d.department_name,
    expandable: d.is_group ? 1 : 0,
  }));
}
