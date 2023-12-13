import supertest from "supertest";
import app from "../index.js";
import { expect } from "chai";

describe("API Tests", function () {
  describe("POST /fetch-analysis/", function () {
    it("should return already exists error", function (done) {
      supertest(app)
        .post("/fetch-analysis/")
        .send({ meeting_id: "101" })
        .expect("Content-Type", /text/)
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);
          expect(res.body).to.be.an("object");
          done();
        });
    });

    describe("POST /fetch-analysis/", function () {
      it("should return meeting not found error", function (done) {
        supertest(app)
          .post("/fetch-analysis/")
          .send({ meeting_id: "125" })
          .expect("Content-Type", /text/)
          .expect(400)
          .end(function (err, res) {
            if (err) return done(err);
            expect(res.body).to.be.an("object");
            done();
          });
      });
    });
  });

  describe("GET /get-analysis/", function () {
    it("should return analysis for meeting_id 101", function (done) {
      supertest(app)
        .get("/get-analysis/101")
        .expect("Content-Type", /json/)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          expect(res.body).to.be.an("object");
          expect(res.body).to.have.property("Brainstorming");
          expect(res.body).to.have.property("Leadership");
          expect(res.body).to.have.property("CollaborativeWork");
          done();
        });
    });
  });
});
