import { Router } from 'express';
import { 
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  bookmarkPost,
  removeBookmark,
  addComment,
  getComments,
  likeComment,
  unlikeComment,
  getFeed,
  getUserPosts
} from '../controllers/feedController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Post CRUD operations
router.post('/', authenticate, createPost);
router.get('/', getPosts);
router.get('/feed', authenticate, getFeed);
router.get('/my-posts', authenticate, getUserPosts);
router.get('/:id', authenticate, getPost);
router.put('/:id', authenticate, updatePost);
router.delete('/:id', authenticate, deletePost);

// Post interactions
router.post('/:id/like', authenticate, likePost);
router.delete('/:id/like', authenticate, unlikePost);
router.post('/:id/bookmark', authenticate, bookmarkPost);
router.delete('/:id/bookmark', authenticate, removeBookmark);

// Comment operations
router.post('/:id/comments', authenticate, addComment);
router.get('/:id/comments', authenticate, getComments);
router.post('/comments/:id/like', authenticate, likeComment);
router.delete('/comments/:id/like', authenticate, unlikeComment);

export default router;