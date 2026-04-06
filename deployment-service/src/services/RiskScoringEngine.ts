import { formatInTimeZone } from 'date-fns-tz';

const DATA_SERVICE_URL = process.env['DATA_SERVICE_URL'] || 'http://localhost:8002';
const TIMEZONE = 'Asia/Kuala Lumpur';

export class RiskScoringEngine {
  /**
   * Calculates the deployment risk score (0-100) based on timing, 
   * live incident telemetry, and build-specific security profiles.
   */
  static async calculateRiskScore(commitHash: string): Promise<number> {
    let score = 0;

    try {
      // 1. Fetch Telemetry Data
      const [incidentCount, cves] = await Promise.all([
        this.fetchOpenIncidentCount(),
        this.fetchCveResults(commitHash)
      ]);

      // 2. Time-based Penalties (Malaysia UTC+8)
      const now = new Date();
      const dayOfWeek = formatInTimeZone(now, TIMEZONE, 'EEEE'); // e.g., "Friday"
      const hour = parseInt(formatInTimeZone(now, TIMEZONE, 'H')); // 0-23

      // Friday after 4 PM or Weekend
      if ((dayOfWeek === 'Friday' && hour >= 16) || dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday') {
        score += 40;
      } 
      // Outside Business Hours (9 AM - 6 PM)
      else if (hour < 9 || hour >= 18) {
        score += 20;
      }

      // 3. Incident Penalties
      score += (incidentCount * 25);

      // 4. Security Penalties
      cves.forEach((cve: any) => {
        if (cve.severity.toUpperCase() === 'CRITICAL') score += 50;
        else if (cve.severity.toUpperCase() === 'HIGH') score += 15;
      });

      // 5. Cap and Persistence
      const finalScore = Math.min(score, 100);
      
      await this.persistRiskScore(commitHash, finalScore);
      
      console.log(`[RiskScoringEngine]: Score for ${commitHash.substring(0, 7)}: ${finalScore}`);
      return finalScore;

    } catch (error) {
      console.error(`[RiskScoringEngine]: Failure during assessment for ${commitHash}:`, error);
      return 0;
    }
  }

  private static async fetchOpenIncidentCount(): Promise<number> {
    const res = await fetch(`${DATA_SERVICE_URL}/api/v1/incidents/count?incident_status=Open`);
    if (!res.ok) return 0;
    return await res.json();
  }

  private static async fetchCveResults(commitHash: string): Promise<any[]> {
    const res = await fetch(`${DATA_SERVICE_URL}/api/v1/security/scans/${commitHash}`);
    if (!res.ok) return [];
    return await res.json();
  }

  private static async persistRiskScore(commitHash: string, score: number): Promise<void> {
    await fetch(`${DATA_SERVICE_URL}/api/v1/deployments/${commitHash}?risk_score=${score}`, {
      method: 'PATCH'
    });
  }
}
