const { PrismaClient } = require("@prisma/client");
const express = require("express");
const jwt = require("jsonwebtoken");

const verifyToken = require("../middlewares/protected");

const docRouter = express.Router();
const prisma = new PrismaClient();

docRouter.post("/create", verifyToken, async (req, res) => {
  const { title } = req.body;
  const { id } = req.user;
  try {
    const doc = await prisma.document.create({
      data: {
        title,
        content: "",
        ownerId: id,
      },
    });
    res.status(200).json({ message: "Document created successfully", doc });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

docRouter.get("/myDocs", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch documents where the user is the owner
    const ownedDocuments = await prisma.document.findMany({
      where: { ownerId: userId },
    });

    // Fetch documents where the user has access (EDITOR or VIEWER roles)
    const accessDocuments = await prisma.documentAccess.findMany({
      where: { userId },
      include: { Document: true },
    });

    // Combine owned documents and accessed documents
    const accessedDocs = accessDocuments.map((access) => ({
      ...access.Document,
      role: access.role, // Include the user's role for these documents
    }));

    const myOwnedDocs = ownedDocuments.map((doc) => ({
      ...doc,
      role: "OWNER", // Set the role to 'OWNER' for owned documents
    }));

    const allDocuments = [...myOwnedDocs, ...accessedDocs];

    // Return the documents as a response
    res.json({ documents: allDocuments });
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).send("Internal server error");
  }
});

docRouter.post("/share", verifyToken, async (req, res) => {
  const { docId, userId, role } = req.body;
  if (!docId || !userId || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }
  try {
    const document = await prisma.document.findUnique({
      where: {
        id: docId,
      },
    });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (document.ownerId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not the owner of this document" });
    }
    const doc = await prisma.documentAccess.create({
      data: {
        userId,
        documentId: docId,
        role,
      },
    });
    console.log(doc);
    res.status(200).json({ message: "Document shared successfully", doc });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

docRouter.put("/modify-share", verifyToken, async (req, res) => {
  const { docId,  role,accessId} = req.body;
  if (!docId ||  !role || !accessId) {
    return res.status(400).json({ message: "All fields are required" });
  }
  try {
    const document = await prisma.document.findUnique({
      where: {
        id: docId,
      },
    });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (document.ownerId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not the owner of this document" });
    }
    const doc = await prisma.documentAccess.update({
      where: {
        id: accessId,

      },
      data: {
        role,
      },
    });
    console.log(doc);
    res.status(200).json({ message: "Document shared successfully", doc });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

docRouter.get("/:docId", verifyToken, async (req, res) => {
  const { docId } = req.params;
  try {
    const doc = await prisma.document.findUnique({
      where: {
        id: docId,
      },
      select: {
        id: true,
        title: true,
        content: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        access: true,
        versions: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.status(200).json({ message: "Document fetched successfully", doc });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

docRouter.delete("/:docId", verifyToken, async (req, res) => {
  const { docId } = req.params;
  try {
    const doc = await prisma.document.findUnique({
      where: {
        id: docId,
      },
    });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }
    if (doc.ownerId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not the owner of this document" });
    }
    const deletedDoc = await prisma.document.delete({
      where: {
        id: docId,
      },
    });
    res.status(200).json({ message: "Document deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

docRouter.post("/version", verifyToken, async (req, res) => {
  const { docId, name, content } = req.body;
  try {
    const doc = await prisma.document.findUnique({
      where: {
        id: docId,
      },
    });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }
    const version = await prisma.version.create({
      data: {
        content: content,
        documentId: docId,
        name,
      },
    });
    res.status(200).json({ message: "Version created successfully", version });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

//Currently not in use
docRouter.get("/version/:docId", verifyToken, async (req, res) => {
  const { docId } = req.params;
  try {
    const versions = await prisma.document.findUnique({
      where: {
        id: docId,
      },
      select: {
        versions: {
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });
    if (!versions) {
      return res.status(404).json({ message: "Document not found" });
    }
    res
      .status(200)
      .json({ message: "Versions fetched successfully", versions });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

docRouter.delete(
  "/delete-version/:versionId",
  verifyToken,
  async (req, res) => {
    const { versionId } = req.params;
    try {
      const version = await prisma.version.findUnique({
        where: {
          id: versionId,
        },
      });
      if (!version) {
        return res.status(404).json({ message: "Version not found" });
      }
      const deletedVersion = await prisma.version.delete({
        where: {
          id: versionId,
        },
      });

      res.status(200).json({ message: "Version deleted successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

docRouter.put("/save", verifyToken, async (req, res) => {
  const { docId, content } = req.body;
  try {
    const doc = await prisma.document.findUnique({
      where: {
        id: docId,
      },
    });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }
    const updatedDoc = await prisma.document.update({
      where: {
        id: docId,
      },
      data: {
        content,
      },
    });
    res
      .status(200)
      .json({ message: "Document updated successfully", updatedDoc });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

docRouter.post("/rollback/:docId", verifyToken, async (req, res) => {
  const { versionId } = req.body;
  const { docId } = req.params;
  try {
    const doc = await prisma.document.findUnique({
      where: {
        id: docId,
      },
    });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }
    const version = await prisma.version.findUnique({
      where: {
        id: versionId,
      },
    });
    if (!version) {
      return res.status(404).json({ message: "Version not found" });
    }
    const updatedDoc = await prisma.document.update({
      where: {
        id: docId,
      },
      data: {
        content: version.content,
        updatedAt: new Date(),
      },
    });
    res
      .status(200)
      .json({ message: "Version set successfully", updatedDoc, version });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

docRouter.post("/generate-link", verifyToken, async (req, res) => {
  const { docId, ownerId, role } = req.body;
  try {
    console.log(req.body);
    const doc = await prisma.document.findUnique({
      where: {
        id: docId,
      },
    });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }
    if (doc.ownerId !== ownerId) {
      return res
        .status(401)
        .json({ message: "You are not the owner of this document" });
    }

    const tokenObject = {
      id: docId,
      role,
    };
    const token = jwt.sign(tokenObject, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({ message: "Token generated successfully", token });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

docRouter.post("/verify-link", async (req, res) => {
  const { token } = req.body;
  try {
    if (!token) {
      return res.status(400).json({ message: "Token not found" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid token" });
    }

    res.status(200).json({ message: "Token verified successfully", decoded });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = docRouter;
