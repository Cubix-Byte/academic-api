import { Router } from "express";
import * as communityController from "../../controllers/v1/community.controller";

const router = Router();

/**
 * -----------------------------------------
 * CORE COMMUNITY MANAGEMENT
 * -----------------------------------------
 */
// GET /api/v1/communities => Fetch all associated communities
// POST /api/v1/communities => Create a new Club community (ADMIN only)
router
  .route("/")
  .get(communityController.getMyCommunities)
  .post(communityController.createClubCommunity);

// GET /api/v1/communities/:id/members => ADMIN ONLY logic inside controller
router.route("/:id/members").get(communityController.getCommunityMembers);

// POST /api/v1/communities/:id/members => ADMIN ONLY explicitly add
// DELETE /api/v1/communities/:id/members/:userId => ADMIN ONLY explicitly remove
router.route("/:id/members").post(communityController.addClubMember);
router
  .route("/:id/members/:userId")
  .delete(communityController.removeClubMember);

/**
 * -----------------------------------------
 * POSTS
 * -----------------------------------------
 */
// GET /api/v1/communities/:id/posts => Fetch Feed
// POST /api/v1/communities/:id/posts => Create Post
router
  .route("/:id/posts")
  .get(communityController.getCommunityFeed)
  .post(communityController.createPost);

/**
 * -----------------------------------------
 * INTERACTIONS (POST LEVEL)
 * -----------------------------------------
 */
// PATCH /api/v1/communities/posts/:postId/like
router.route("/posts/:postId/like").patch(communityController.toggleLike);

// PATCH/DELETE /api/v1/communities/posts/:postId  => Author or Admin Only
router
  .route("/posts/:postId")
  .delete(communityController.deletePost)
  .patch(communityController.editPost);

/**
 * -----------------------------------------
 * COMMENTS
 * -----------------------------------------
 */
// GET /api/v1/communities/posts/:postId/comments => Fetch Comments (supports ?parentId= query)
// POST /api/v1/communities/posts/:postId/comments => Add a Comment
router
  .route("/posts/:postId/comments")
  .get(communityController.getComments)
  .post(communityController.createComment);

router
  .route("/posts/:postId/comments/:commentId/like")
  .patch(communityController.toggleCommentLike);

export default router;
