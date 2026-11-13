import { describe, expect, it } from 'vitest';
import { componentHintFromMetadata, isComponentPickResultMessage } from './component-picker';

describe('Salesforce component picker', () => {
  it('identifies a custom LWC without reading rendered page content', () => {
    expect(componentHintFromMetadata({ tagName: 'C-SALES-OPPORTUNITY-PANEL' })).toEqual({
      componentName: 'salesOpportunityPanel',
      kindHint: 'lwc',
      namespace: 'c',
      tagName: 'c-sales-opportunity-panel',
    });
  });

  it('identifies namespaced LWC and Aura component markers', () => {
    expect(componentHintFromMetadata({ tagName: 'i360core-sales-appointment-action' })).toEqual(
      expect.objectContaining({
        componentName: 'salesAppointmentAction',
        namespace: 'i360core',
        kindHint: 'lwc',
      }),
    );
    expect(componentHintFromMetadata({ auraClass: 'acme:ResultAppointment' })).toEqual({
      componentName: 'ResultAppointment',
      namespace: 'acme',
      kindHint: 'aura',
      descriptor: 'acme:ResultAppointment',
    });
  });

  it('ignores Salesforce framework elements and descriptors', () => {
    expect(componentHintFromMetadata({ tagName: 'LIGHTNING-BUTTON' })).toBeUndefined();
    expect(componentHintFromMetadata({ tagName: 'RECORDS-RECORD-LAYOUT-BLOCK' })).toBeUndefined();
    expect(componentHintFromMetadata({ auraClass: 'force:recordData' })).toBeUndefined();
  });

  it('validates component results received from the Salesforce parent page', () => {
    expect(
      isComponentPickResultMessage({
        type: 'VARKOLE_COMPONENT_PICK_RESULT',
        status: 'found',
        component: { componentName: 'quickActionPanel', kindHint: 'lwc', namespace: 'c' },
      }),
    ).toBe(true);
    expect(
      isComponentPickResultMessage({
        type: 'VARKOLE_COMPONENT_PICK_RESULT',
        status: 'found',
        component: { componentName: "bad' OR Name != ''", kindHint: 'lwc' },
      }),
    ).toBe(false);
  });
});
