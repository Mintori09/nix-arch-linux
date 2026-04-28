export function getDocumentStatusAction({
  status,
  lastSyncedRevision,
  acknowledgedRemoteRevision,
  isDirty,
}) {
  if (!status?.tracked || !status?.revision_id || !status?.changed) {
    return 'ignore';
  }

  if (
    status.revision_id === lastSyncedRevision ||
    status.revision_id === acknowledgedRemoteRevision
  ) {
    return 'ignore';
  }

  if (status.conflict || isDirty) {
    return 'conflict';
  }

  return 'reload';
}
