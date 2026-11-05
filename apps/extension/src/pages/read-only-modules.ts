import type { ReadOnlyQueryConfig } from './ReadOnlyQueryPage';
import { addCoveragePercentages } from './coverage-utils';

export const READ_ONLY_MODULES: Record<string, ReadOnlyQueryConfig> = {
  coverage: {
    title: 'Code Coverage',
    eyebrow: 'Apex tests · read-only',
    actionLabel: 'Load coverage',
    mode: 'tooling',
    transformResult: addCoveragePercentages,
    columnLabels: {
      Name: 'File',
      Coverage: 'Coverage',
      CoveredLines: 'Covered',
      UncoveredLines: 'Uncovered',
      TotalLines: 'Total lines',
    },
    query:
      'SELECT ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate ORDER BY ApexClassOrTrigger.Name LIMIT 200',
  },
  users: {
    title: 'Users',
    eyebrow: 'Administration · read-only',
    actionLabel: 'Load users',
    mode: 'rest',
    columnLabels: {
      Name: 'Name',
      Username: 'Username',
      Email: 'Email',
      IsActive: 'Active',
      UserType: 'User type',
      'Profile.Name': 'Profile',
      LastLoginDate: 'Last login',
    },
    query:
      'SELECT Name, Username, Email, IsActive, UserType, Profile.Name, LastLoginDate FROM User ORDER BY Name LIMIT 200',
  },
  access: {
    title: 'Access Assignments',
    eyebrow: 'Administration · read-only',
    actionLabel: 'Load assignments',
    mode: 'rest',
    columnLabels: {
      'Assignee.Name': 'User',
      'Assignee.Username': 'Username',
      'PermissionSet.Label': 'Permission set',
      'PermissionSet.IsOwnedByProfile': 'From profile',
    },
    query:
      'SELECT Assignee.Name, Assignee.Username, PermissionSet.Label, PermissionSet.IsOwnedByProfile FROM PermissionSetAssignment ORDER BY Assignee.Name LIMIT 200',
  },
};
