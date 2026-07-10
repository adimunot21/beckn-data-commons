/**
 * REAL captured outputs from a live run of the sandbox network (see the
 * capturedAt timestamp). Used by the static site build, where no backend is
 * available: the demo replays this run and says so. Regenerate by running the
 * flow against a live stack and re-capturing (docs/DEPLOY.md).
 */
export const RECORDED = {
  capturedAt: '2026-07-10T14:48:32.494Z',
  transactionId: '8f6e609e-ebe6-4794-b4c2-facb24660438',
  offers: [
    {
      offerId: 'offer-churn-full',
      bppId: 'bpp.tabular.local',
      bppUri: 'http://localhost:3002',
      resourceId: 'ds-churn',
      name: 'Customer Churn — Full (CSV)',
      description: 'Synthetic telco churn dataset for binary classification.',
      kind: 'dataset',
      modality: 'tabular',
      taskType: 'classification',
      licenseClass: 'permissive',
      rowCount: 3000,
      columnCount: 6,
      attributes: {
        '@context':
          'https://raw.githubusercontent.com/beckn/DDM/main/specification/schema/DatasetItem/v1/context.jsonld',
        '@type': 'DatasetItem',
        'schema:identifier': 'ds-churn',
        'schema:name': 'Customer Churn',
        'schema:description': 'Synthetic telco churn dataset for binary classification.',
        'schema:temporalCoverage': '2025-01-01/2025-12-31',
        'schema:license': 'https://creativecommons.org/licenses/by/4.0/',
        'schema:conditionsOfAccess': 'Attribution required; no resale of raw data.',
        'dataset:accessMethod': 'DOWNLOAD',
        'dataset:rowCountEstimate': 3000,
        'dataset:columnCount': 6,
        'dataset:dataType': 'TabularCsv',
        'dataset:refreshType': 'STATIC',
        'dataset:sensitivityLevel': 'PUBLIC',
        'bdc:resourceKind': 'dataset',
        'bdc:modality': 'tabular',
        'bdc:taskType': 'classification',
        'bdc:licenseClass': 'permissive',
      },
    },
    {
      offerId: 'offer-churn-logreg',
      bppId: 'bpp.models.local',
      bppUri: 'http://localhost:3022',
      resourceId: 'model-churn-logreg',
      name: 'Churn LogReg — Weights (JSON)',
      description: 'Pretrained logistic-regression churn classifier weights.',
      kind: 'model',
      modality: 'tabular',
      taskType: 'classification',
      licenseClass: 'permissive',
      rowCount: 0,
      columnCount: 3,
      attributes: {
        '@context':
          'https://raw.githubusercontent.com/beckn/DDM/main/specification/schema/DatasetItem/v1/context.jsonld',
        '@type': 'DatasetItem',
        'schema:identifier': 'model-churn-logreg',
        'schema:name': 'Churn LogReg',
        'schema:description': 'Pretrained logistic-regression churn classifier weights.',
        'schema:temporalCoverage': '2025-01-01/2025-12-31',
        'schema:license': 'https://creativecommons.org/licenses/by/4.0/',
        'schema:conditionsOfAccess': 'Attribution required; no resale of raw data.',
        'dataset:accessMethod': 'DOWNLOAD',
        'dataset:rowCountEstimate': 0,
        'dataset:columnCount': 3,
        'dataset:dataType': 'PretrainedModel',
        'dataset:refreshType': 'STATIC',
        'dataset:sensitivityLevel': 'PUBLIC',
        'bdc:resourceKind': 'model',
        'bdc:modality': 'tabular',
        'bdc:taskType': 'classification',
        'bdc:licenseClass': 'permissive',
      },
    },
  ],
  grant: {
    claims: {
      v: 'bdc-grant/1',
      grantId: '6c95c5da-f421-4dc9-b045-93d59e0b8fad',
      issuer: 'access-manager.bdc.local',
      issuerKeyId: 'access-manager.bdc.local|key-1|ed25519',
      grantee: {
        id: 'demo-recorded',
      },
      provider: {
        bppId: 'bpp.tabular.local',
        bppUri: 'http://bpp-tabular:3002',
      },
      resource: {
        resourceId: 'ds-churn',
        offerId: 'offer-churn-full',
      },
      scope: {
        kind: 'full',
      },
      licenseClass: 'permissive',
      purpose: 'train a churn model (sandbox demo)',
      transactionId: '8f6e609e-ebe6-4794-b4c2-facb24660438',
      issuedAt: 1783694868,
      notBefore: 1783694868,
      expiresAt: 1783698468,
      revocable: true,
      nonce: '00d138c8-acce-4ccb-8970-702b914085af',
    },
    alg: 'ed25519',
    signature:
      'a04bbc3ccb200ec88ecf7cad31ca6a315c1f0f3ad17a86a019cfc2be99a64bc0080398b294a6febe5d5adc357676195f7d13e998d6c7ef89b09d7dba879d5e03',
  },
  accessUrl:
    'https://<your-host>/bpp-tabular/download?offerId=offer-churn-full&resourceId=ds-churn',
  download: {
    ok: true,
    httpStatus: 200,
    filename: 'churn.csv',
    bytes: 104042,
    preview:
      'customer_id,age,tenure_months,monthly_charges,contract,churn\ncust-0,26,55,74.06,one-year,0\ncust-1,59,42,116.33,month-to-month,1\ncust-2,41,57,59.13,two-year,0\ncust-3,24,4,61.77,month-to-month,1\ncust-4,63,19,25.66,one-year,1',
  },
  revoke: {
    grantId: '6c95c5da-f421-4dc9-b045-93d59e0b8fad',
    status: 'REVOKED',
    outcome: 'revoked',
  },
  denied: {
    ok: false,
    httpStatus: 403,
    error: 'revoked',
  },
} as const;
