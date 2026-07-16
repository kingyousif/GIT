import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { KVStore, Patient, Session, Report, Template, Settings } from "../db/models.js";

function toReportResponse(doc: any) {
  const report = typeof doc?.toObject === "function" ? doc.toObject() : { ...doc };
  report.id = report._id;
  delete report._id;
  return report;
}

function reportFields(body: any, id?: string) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Report payload must be an object.");
  }
  if (!body.sessionId || !body.doctorName || !Array.isArray(body.sections)) {
    throw new Error("sessionId, doctorName, and sections are required.");
  }
  if (body.status !== "draft" && body.status !== "final") {
    throw new Error("Report status must be draft or final.");
  }

  return {
    ...(id ? { _id: id } : {}),
    sessionId: body.sessionId,
    doctorName: body.doctorName,
    templateUsed: body.templateUsed,
    sections: body.sections,
    diagnosis: Array.isArray(body.diagnosis) ? body.diagnosis : [],
    recommendations: Array.isArray(body.recommendations) ? body.recommendations : [],
    followUp: body.followUp,
    biopsy: Boolean(body.biopsy),
    biopsyLocation: body.biopsyLocation,
    biopsySentTo: body.biopsySentTo,
    freeReportHtml: body.freeReportHtml,
    createdAt: body.createdAt,
    updatedAt: body.updatedAt,
    status: body.status,
  };
}

/**
 * Generic key-value storage route backed by MongoDB.
 * Maps specific storage keys to their corresponding dedicated MongoDB collections.
 * Mirrors the Next.js /api/storage/[key] route for frontend compatibility.
 */

export async function storageRoutes(app: FastifyInstance) {
  // Record-level report CRUD. These routes avoid replacing the entire report
  // collection when one doctor creates, edits, or deletes a report.
  app.get("/api/reports", async (request, reply) => {
    const { sessionId } = request.query as { sessionId?: string };
    try {
      const docs = await Report.find(sessionId ? { sessionId } : {}).sort({ updatedAt: -1 }).lean();
      return reply.send(docs.map(toReportResponse));
    } catch (err: any) {
      app.log.error(`Failed to fetch reports: ${err.message}`);
      return reply.code(500).send({ error: "Failed to fetch reports." });
    }
  });

  app.get("/api/reports/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const doc = await Report.findById(id).lean();
      if (!doc) return reply.code(404).send({ error: "Report not found." });
      return reply.send(toReportResponse(doc));
    } catch (err: any) {
      app.log.error(`Failed to fetch report ${id}: ${err.message}`);
      return reply.code(500).send({ error: "Failed to fetch report." });
    }
  });

  app.post("/api/reports", async (request, reply) => {
    try {
      const body = request.body as any;
      const reportId = body?.id || randomUUID();
      const existing = await Report.exists({ _id: reportId });
      if (existing) return reply.code(409).send({ error: "A report with this id already exists." });
      const doc = await Report.create(reportFields(body, reportId));
      return reply.code(201).send(toReportResponse(doc));
    } catch (err: any) {
      app.log.error(`Failed to create report: ${err.message}`);
      return reply.code(400).send({ error: err.message || "Failed to create report." });
    }
  });

  app.put("/api/reports/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const fields = reportFields(request.body, id);
      delete (fields as any)._id;
      delete (fields as any).createdAt;
      const doc = await Report.findByIdAndUpdate(id, { $set: fields }, { new: true, runValidators: true });
      if (!doc) return reply.code(404).send({ error: "Report not found." });
      return reply.send(toReportResponse(doc));
    } catch (err: any) {
      app.log.error(`Failed to update report ${id}: ${err.message}`);
      return reply.code(400).send({ error: err.message || "Failed to update report." });
    }
  });

  app.delete("/api/reports/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const doc = await Report.findByIdAndDelete(id);
      if (!doc) return reply.code(404).send({ error: "Report not found." });
      return reply.send({ success: true });
    } catch (err: any) {
      app.log.error(`Failed to delete report ${id}: ${err.message}`);
      return reply.code(500).send({ error: "Failed to delete report." });
    }
  });

  // GET /api/storage/:key
  app.get("/api/storage/:key", async (request, reply) => {
    const { key } = request.params as { key: string };
    
    try {
      if (key === "endo_patients") {
        const docs = await Patient.find({}).lean();
        const result = docs.map((d: any) => {
          const id = d._id;
          const copy = { ...d, id };
          delete copy._id;
          return copy;
        });
        return reply.send(result);
      }
      
      if (key === "endo_sessions") {
        const docs = await Session.find({}).lean();
        const result = docs.map((d: any) => {
          const id = d._id;
          const copy = { ...d, id };
          delete copy._id;
          return copy;
        });
        return reply.send(result);
      }
      
      if (key === "endo_reports") {
        const docs = await Report.find({}).lean();
        const result = docs.map((d: any) => {
          const id = d._id;
          const copy = { ...d, id };
          delete copy._id;
          return copy;
        });
        return reply.send(result);
      }
      
      if (key === "endo_templates") {
        const docs = await Template.find({}).lean();
        const result = docs.map((d: any) => {
          const id = d._id;
          const copy = { ...d, id };
          delete copy._id;
          return copy;
        });
        return reply.send(result);
      }
      
      if (key === "endo_settings") {
        const doc = await Settings.findOne({ _key: "global" }).lean();
        if (!doc) return reply.send(null);
        const copy = { ...doc };
        delete (copy as any)._id;
        delete (copy as any)._key;
        return reply.send(copy);
      }
    } catch (err: any) {
      app.log.error(`Failed to fetch dedicated collection for key ${key}: ${err.message}`);
    }

    // Catch-all: Fallback to generic KVStore
    const doc = await KVStore.findOne({ key }).lean();
    if (!doc) return reply.send(null);
    return reply.send(doc.value);
  });

  // PUT /api/storage/:key
  app.put("/api/storage/:key", async (request, reply) => {
    const { key } = request.params as { key: string };
    const body = request.body;

    try {
      if (key === "endo_patients") {
        const patients = body as any[];
        await Patient.deleteMany({});
        if (patients && patients.length > 0) {
          await Patient.insertMany(patients.map(p => ({
            _id: p.id,
            patientCode: p.patientCode,
            fullName: p.fullName,
            age: p.age,
            gender: p.gender,
            phone: p.phone,
            address: p.address,
            referredBy: p.referredBy,
            createdAt: p.createdAt
          })));
        }
      } else if (key === "endo_sessions") {
        const sessions = body as any[];
        await Session.deleteMany({});
        if (sessions && sessions.length > 0) {
          await Session.insertMany(sessions.map(s => ({
            _id: s.id,
            patientId: s.patientId,
            procedureType: s.procedureType,
            doctorName: s.doctorName,
            scheduledAt: s.scheduledAt,
            status: s.status,
            indication: s.indication,
            preparation: s.preparation,
            sedation: s.sedation,
            findings: s.findings,
            questionnaireAnswers: s.questionnaireAnswers,
            createdAt: s.createdAt,
            completedAt: s.completedAt
          })));
        }
      } else if (key === "endo_reports") {
        const reports = body as any[];
        await Report.deleteMany({});
        if (reports && reports.length > 0) {
          await Report.insertMany(reports.map(r => ({
            _id: r.id,
            sessionId: r.sessionId,
            doctorName: r.doctorName,
            templateUsed: r.templateUsed,
            sections: r.sections,
            diagnosis: r.diagnosis,
            recommendations: r.recommendations,
            followUp: r.followUp,
            biopsy: r.biopsy,
            biopsyLocation: r.biopsyLocation,
            biopsySentTo: r.biopsySentTo,
            freeReportHtml: r.freeReportHtml,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            status: r.status
          })));
        }
      } else if (key === "endo_templates") {
        const templates = body as any[];
        await Template.deleteMany({});
        if (templates && templates.length > 0) {
          await Template.insertMany(templates.map(t => ({
            _id: t.id,
            name: t.name,
            procedureType: t.procedureType,
            sections: t.sections,
            diagnoses: t.diagnoses
          })));
        }
      } else if (key === "endo_settings") {
        await Settings.findOneAndUpdate(
          { _key: "global" },
          { _key: "global", ...(body as any) },
          { upsert: true }
        );
      }
    } catch (err: any) {
      app.log.error(`Failed to save to dedicated collection for key ${key}: ${err.message}`);
      return reply.code(500).send({ error: `Failed to persist ${key}.` });
    }

    // Always mirror to KVStore for backward-compatibility & simplicity
    await KVStore.findOneAndUpdate(
      { key },
      { key, value: body },
      { upsert: true },
    );
    return { success: true };
  });

  // DELETE /api/storage/:key
  app.delete("/api/storage/:key", async (request) => {
    const { key } = request.params as { key: string };
    
    try {
      if (key === "endo_patients") {
        await Patient.deleteMany({});
      } else if (key === "endo_sessions") {
        await Session.deleteMany({});
      } else if (key === "endo_reports") {
        await Report.deleteMany({});
      } else if (key === "endo_templates") {
        await Template.deleteMany({});
      } else if (key === "endo_settings") {
        await Settings.deleteMany({ _key: "global" });
      }
    } catch (err: any) {
      app.log.error(`Failed to delete dedicated collection for key ${key}: ${err.message}`);
    }

    await KVStore.deleteOne({ key });
    return { success: true };
  });
}
