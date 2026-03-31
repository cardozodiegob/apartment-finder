import { describe, it, expect } from "vitest";
import mongoose from "mongoose";

// Import all models to verify they compile and export correctly
import User from "@/lib/db/models/User";
import Listing from "@/lib/db/models/Listing";
import Review from "@/lib/db/models/Review";
import Payment from "@/lib/db/models/Payment";
import Report from "@/lib/db/models/Report";
import Notification from "@/lib/db/models/Notification";
import ConsentLog from "@/lib/db/models/ConsentLog";

describe("Mongoose Models", () => {
  describe("User model", () => {
    it("should have the correct schema fields", () => {
      const paths = User.schema.paths;
      expect(paths).toHaveProperty("supabaseId");
      expect(paths).toHaveProperty("email");
      expect(paths).toHaveProperty("fullName");
      expect(paths).toHaveProperty("role");
      expect(paths).toHaveProperty("preferredLanguage");
      expect(paths).toHaveProperty("preferredCurrency");
      expect(paths).toHaveProperty("trustScore");
      expect(paths).toHaveProperty("completedTransactions");
      expect(paths).toHaveProperty("profileCompleteness");
      expect(paths).toHaveProperty("isSuspended");
      expect(paths).toHaveProperty("suspensionReason");
      expect(paths).toHaveProperty("confirmedScamReports");
      expect(paths).toHaveProperty("notificationPreferences");
      expect(paths).toHaveProperty("createdAt");
      expect(paths).toHaveProperty("updatedAt");
    });

    it("should have unique indexes on email and supabaseId", () => {
      const indexes = User.schema.indexes();
      const emailIndex = indexes.find(
        ([fields]) => fields && "email" in fields
      );
      const supabaseIdIndex = indexes.find(
        ([fields]) => fields && "supabaseId" in fields
      );
      expect(emailIndex).toBeDefined();
      expect(emailIndex![1]).toHaveProperty("unique", true);
      expect(supabaseIdIndex).toBeDefined();
      expect(supabaseIdIndex![1]).toHaveProperty("unique", true);
    });

    it("should have correct enum values for role", () => {
      const rolePath = User.schema.path("role") as mongoose.SchemaType & {
        enumValues?: string[];
      };
      expect(rolePath.enumValues).toEqual(["seeker", "poster", "admin"]);
    });

    it("should default role to seeker", () => {
      const doc = new User({
        supabaseId: "test-id",
        email: "test@example.com",
        fullName: "Test User",
      });
      expect(doc.role).toBe("seeker");
    });
  });

  describe("Listing model", () => {
    it("should have the correct schema fields", () => {
      const paths = Listing.schema.paths;
      expect(paths).toHaveProperty("posterId");
      expect(paths).toHaveProperty("title");
      expect(paths).toHaveProperty("description");
      expect(paths).toHaveProperty("propertyType");
      expect(paths).toHaveProperty("purpose");
      expect(paths).toHaveProperty("address");
      expect(paths).toHaveProperty("location");
      expect(paths).toHaveProperty("monthlyRent");
      expect(paths).toHaveProperty("currency");
      expect(paths).toHaveProperty("availableDate");
      expect(paths).toHaveProperty("photos");
      expect(paths).toHaveProperty("photoHashes");
      expect(paths).toHaveProperty("tags");
      expect(paths).toHaveProperty("isSharedAccommodation");
      expect(paths).toHaveProperty("currentOccupants");
      expect(paths).toHaveProperty("availableRooms");
      expect(paths).toHaveProperty("status");
      expect(paths).toHaveProperty("scamRiskLevel");
      expect(paths).toHaveProperty("createdAt");
      expect(paths).toHaveProperty("updatedAt");
    });

    it("should have compound, text, and 2dsphere indexes", () => {
      const indexes = Listing.schema.indexes();

      const compoundIndex = indexes.find(
        ([fields]) =>
          fields &&
          "status" in fields &&
          "propertyType" in fields &&
          "monthlyRent" in fields
      );
      expect(compoundIndex).toBeDefined();

      const textIndex = indexes.find(
        ([fields]) =>
          fields &&
          fields.title === "text" &&
          fields.description === "text" &&
          fields.tags === "text"
      );
      expect(textIndex).toBeDefined();

      const geoIndex = indexes.find(
        ([fields]) => fields && fields.location === "2dsphere"
      );
      expect(geoIndex).toBeDefined();
    });

    it("should default status to draft", () => {
      const doc = new Listing({
        posterId: new mongoose.Types.ObjectId(),
        title: "Test",
        description: "Test desc",
        propertyType: "apartment",
        purpose: "rent",
        address: {
          street: "123 Main St",
          city: "Berlin",
          postalCode: "10115",
          country: "Germany",
        },
        location: { type: "Point", coordinates: [13.405, 52.52] },
        monthlyRent: 1000,
        currency: "EUR",
        availableDate: new Date(),
      });
      expect(doc.status).toBe("draft");
    });

    it("should have correct enum values for propertyType", () => {
      const typePath = Listing.schema.path(
        "propertyType"
      ) as mongoose.SchemaType & { enumValues?: string[] };
      expect(typePath.enumValues).toEqual(["apartment", "room", "house"]);
    });

    it("should have correct enum values for status", () => {
      const statusPath = Listing.schema.path(
        "status"
      ) as mongoose.SchemaType & { enumValues?: string[] };
      expect(statusPath.enumValues).toEqual([
        "draft",
        "active",
        "under_review",
        "archived",
      ]);
    });
  });

  describe("Review model", () => {
    it("should have the correct schema fields", () => {
      const paths = Review.schema.paths;
      expect(paths).toHaveProperty("reviewerId");
      expect(paths).toHaveProperty("reviewedUserId");
      expect(paths).toHaveProperty("transactionId");
      expect(paths).toHaveProperty("rating");
      expect(paths).toHaveProperty("comment");
      expect(paths).toHaveProperty("createdAt");
    });

    it("should have compound index on reviewedUserId and createdAt", () => {
      const indexes = Review.schema.indexes();
      const compoundIndex = indexes.find(
        ([fields]) =>
          fields && "reviewedUserId" in fields && "createdAt" in fields
      );
      expect(compoundIndex).toBeDefined();
    });

    it("should enforce rating min 1 and max 5", () => {
      const ratingPath = Review.schema.path("rating") as mongoose.SchemaType & {
        options?: { min?: number; max?: number };
      };
      expect(ratingPath.options?.min).toBe(1);
      expect(ratingPath.options?.max).toBe(5);
    });
  });

  describe("Payment model", () => {
    it("should have the correct schema fields", () => {
      const paths = Payment.schema.paths;
      expect(paths).toHaveProperty("seekerId");
      expect(paths).toHaveProperty("posterId");
      expect(paths).toHaveProperty("listingId");
      expect(paths).toHaveProperty("amount");
      expect(paths).toHaveProperty("currency");
      expect(paths).toHaveProperty("stripePaymentIntentId");
      expect(paths).toHaveProperty("status");
      expect(paths).toHaveProperty("seekerConfirmedAt");
      expect(paths).toHaveProperty("posterConfirmedAt");
      expect(paths).toHaveProperty("escrowExpiresAt");
      expect(paths).toHaveProperty("disputeReason");
      expect(paths).toHaveProperty("receiptUrl");
      expect(paths).toHaveProperty("createdAt");
      expect(paths).toHaveProperty("updatedAt");
    });

    it("should have indexes on seekerId and posterId", () => {
      const indexes = Payment.schema.indexes();
      const seekerIndex = indexes.find(
        ([fields]) => fields && "seekerId" in fields
      );
      const posterIndex = indexes.find(
        ([fields]) => fields && "posterId" in fields
      );
      expect(seekerIndex).toBeDefined();
      expect(posterIndex).toBeDefined();
    });

    it("should have correct enum values for status", () => {
      const statusPath = Payment.schema.path(
        "status"
      ) as mongoose.SchemaType & { enumValues?: string[] };
      expect(statusPath.enumValues).toEqual([
        "pending",
        "seeker_confirmed",
        "poster_confirmed",
        "both_confirmed",
        "processing",
        "completed",
        "cancelled",
        "disputed",
      ]);
    });

    it("should have correct enum values for currency", () => {
      const currencyPath = Payment.schema.path(
        "currency"
      ) as mongoose.SchemaType & { enumValues?: string[] };
      expect(currencyPath.enumValues).toEqual(["EUR", "GBP", "CHF", "USD"]);
    });
  });

  describe("Report model", () => {
    it("should have the correct schema fields", () => {
      const paths = Report.schema.paths;
      expect(paths).toHaveProperty("reporterId");
      expect(paths).toHaveProperty("reportedUserId");
      expect(paths).toHaveProperty("reportedListingId");
      expect(paths).toHaveProperty("category");
      expect(paths).toHaveProperty("description");
      expect(paths).toHaveProperty("status");
      expect(paths).toHaveProperty("resolution");
      expect(paths).toHaveProperty("resolvedBy");
      expect(paths).toHaveProperty("resolvedAt");
      expect(paths).toHaveProperty("createdAt");
    });

    it("should have compound index on status and createdAt", () => {
      const indexes = Report.schema.indexes();
      const compoundIndex = indexes.find(
        ([fields]) => fields && "status" in fields && "createdAt" in fields
      );
      expect(compoundIndex).toBeDefined();
    });

    it("should have correct enum values for category", () => {
      const catPath = Report.schema.path("category") as mongoose.SchemaType & {
        enumValues?: string[];
      };
      expect(catPath.enumValues).toEqual([
        "suspected_scam",
        "misleading_information",
        "harassment",
        "other",
      ]);
    });
  });

  describe("Notification model", () => {
    it("should have the correct schema fields", () => {
      const paths = Notification.schema.paths;
      expect(paths).toHaveProperty("userId");
      expect(paths).toHaveProperty("type");
      expect(paths).toHaveProperty("title");
      expect(paths).toHaveProperty("body");
      expect(paths).toHaveProperty("isRead");
      expect(paths).toHaveProperty("isDismissed");
      expect(paths).toHaveProperty("metadata");
      expect(paths).toHaveProperty("createdAt");
    });

    it("should have compound index on userId, isRead, and createdAt", () => {
      const indexes = Notification.schema.indexes();
      const compoundIndex = indexes.find(
        ([fields]) =>
          fields &&
          "userId" in fields &&
          "isRead" in fields &&
          "createdAt" in fields
      );
      expect(compoundIndex).toBeDefined();
    });

    it("should have correct enum values for type", () => {
      const typePath = Notification.schema.path(
        "type"
      ) as mongoose.SchemaType & { enumValues?: string[] };
      expect(typePath.enumValues).toEqual([
        "message",
        "payment",
        "report",
        "listing_status",
        "security",
        "roommate_request",
      ]);
    });

    it("should default isRead and isDismissed to false", () => {
      const doc = new Notification({
        userId: new mongoose.Types.ObjectId(),
        type: "message",
        title: "Test",
        body: "Test body",
      });
      expect(doc.isRead).toBe(false);
      expect(doc.isDismissed).toBe(false);
    });
  });

  describe("ConsentLog model", () => {
    it("should have the correct schema fields", () => {
      const paths = ConsentLog.schema.paths;
      expect(paths).toHaveProperty("userId");
      expect(paths).toHaveProperty("purpose");
      expect(paths).toHaveProperty("consented");
      expect(paths).toHaveProperty("timestamp");
      expect(paths).toHaveProperty("ipAddress");
    });
  });
});
