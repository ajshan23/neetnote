import { Request, Response } from 'express';
import Post from '../models/Post';
import Comment from '../models/Comment';
import {IComment} from '../models/Comment';
import Like from '../models/Like';
import Bookmark from '../models/Bookmark';
import { ApiResponse } from '../dto/ApiResponse';
import { Types } from 'mongoose';

/**
 * Create a new post
 */
export const createPost = async (req: Request, res: Response) => {
  try {
    const { title, content, imageUrl, tags, isPublic } = req.body;
    const author = (req as any).user.id;

    const post = new Post({
      title,
      content,
      author,
      imageUrl,
      tags,
      isPublic: isPublic !== undefined ? isPublic : true
    });

    await post.save();
    await post.populate('author', 'name email');

    res.status(201).json(new ApiResponse(true, 'Post created successfully', post));
  } catch (error: any) {
    console.error('Create post error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to create post'));
  }
};

/**
 * Get all posts (with pagination)
 */
export const getPosts = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ isPublic: true })
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ isPublic: true });

    res.status(200).json(new ApiResponse(true, 'Posts fetched successfully', {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error: any) {
    console.error('Get posts error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to fetch posts'));
  }
};

/**
 * Get a single post
 */
export const getPost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const post = await Post.findById(id).populate('author', 'name email');
    
    if (!post) {
      return res.status(404).json(new ApiResponse(false, 'Post not found'));
    }

    // Check if user has liked the post
    const like = await Like.findOne({ user: userId, post: id });
    const isLiked = !!like;

    // Check if user has bookmarked the post
    const bookmark = await Bookmark.findOne({ user: userId, post: id });
    const isBookmarked = !!bookmark;

    // Get like count
    const likeCount = await Like.countDocuments({ post: id });

    // Get comment count
    const commentCount = await Comment.countDocuments({ post: id });

    res.status(200).json(new ApiResponse(true, 'Post fetched successfully', {
      post,
      isLiked,
      isBookmarked,
      likeCount,
      commentCount
    }));
  } catch (error: any) {
    console.error('Get post error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to fetch post'));
  }
};

/**
 * Update a post
 */
export const updatePost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const updates = req.body;

    const post = await Post.findById(id);
    
    if (!post) {
      return res.status(404).json(new ApiResponse(false, 'Post not found'));
    }

    // Check if user is the author
    if (post.author.toString() !== userId) {
      return res.status(403).json(new ApiResponse(false, 'Not authorized to update this post'));
    }

    Object.assign(post, updates);
    await post.save();

    res.status(200).json(new ApiResponse(true, 'Post updated successfully', post));
  } catch (error: any) {
    console.error('Update post error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to update post'));
  }
};

/**
 * Delete a post
 */
export const deletePost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const post = await Post.findById(id);
    
    if (!post) {
      return res.status(404).json(new ApiResponse(false, 'Post not found'));
    }

    // Check if user is the author
    if (post.author.toString() !== userId) {
      return res.status(403).json(new ApiResponse(false, 'Not authorized to delete this post'));
    }

    // Delete associated comments, likes, and bookmarks
    await Comment.deleteMany({ post: id });
    await Like.deleteMany({ post: id });
    await Bookmark.deleteMany({ post: id });

    await Post.findByIdAndDelete(id);

    res.status(200).json(new ApiResponse(true, 'Post deleted successfully'));
  } catch (error: any) {
    console.error('Delete post error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to delete post'));
  }
};

/**
 * Like a post
 */
export const likePost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const post = await Post.findById(id);
    
    if (!post) {
      return res.status(404).json(new ApiResponse(false, 'Post not found'));
    }

    // Check if already liked
    const existingLike = await Like.findOne({ user: userId, post: id });
    if (existingLike) {
      return res.status(400).json(new ApiResponse(false, 'Post already liked'));
    }

    // Create new like
    const like = new Like({
      user: userId,
      post: id
    });

    await like.save();

    res.status(200).json(new ApiResponse(true, 'Post liked successfully'));
  } catch (error: any) {
    console.error('Like post error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to like post'));
  }
};

/**
 * Unlike a post
 */
export const unlikePost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const result = await Like.findOneAndDelete({ user: userId, post: id });
    
    if (!result) {
      return res.status(404).json(new ApiResponse(false, 'Like not found'));
    }

    res.status(200).json(new ApiResponse(true, 'Post unliked successfully'));
  } catch (error: any) {
    console.error('Unlike post error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to unlike post'));
  }
};

/**
 * Bookmark a post
 */
export const bookmarkPost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const post = await Post.findById(id);
    
    if (!post) {
      return res.status(404).json(new ApiResponse(false, 'Post not found'));
    }

    // Check if already bookmarked
    const existingBookmark = await Bookmark.findOne({ user: userId, post: id });
    if (existingBookmark) {
      return res.status(400).json(new ApiResponse(false, 'Post already bookmarked'));
    }

    // Create new bookmark
    const bookmark = new Bookmark({
      user: userId,
      post: id
    });

    await bookmark.save();

    res.status(200).json(new ApiResponse(true, 'Post bookmarked successfully'));
  } catch (error: any) {
    console.error('Bookmark post error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to bookmark post'));
  }
};

/**
 * Remove bookmark from a post
 */
export const removeBookmark = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const result = await Bookmark.findOneAndDelete({ user: userId, post: id });
    
    if (!result) {
      return res.status(404).json(new ApiResponse(false, 'Bookmark not found'));
    }

    res.status(200).json(new ApiResponse(true, 'Bookmark removed successfully'));
  } catch (error: any) {
    console.error('Remove bookmark error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to remove bookmark'));
  }
};

/**
 * Add a comment to a post
 */
export const addComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, parentCommentId } = req.body;
    const author = (req as any).user.id;

    const post = await Post.findById(id);
    
    if (!post) {
      return res.status(404).json(new ApiResponse(false, 'Post not found'));
    }

    const comment = new Comment({
      content,
      author,
      post: id,
      parentComment: parentCommentId || null
    });

    await comment.save();

    // If this is a reply to another comment, add it to the parent's replies
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(
        parentCommentId,
        { $push: { replies: comment._id } }
      );
    }

    await comment.populate('author', 'name email');

    res.status(201).json(new ApiResponse(true, 'Comment added successfully', comment));
  } catch (error: any) {
    console.error('Add comment error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to add comment'));
  }
};

/**
 * Get comments for a post
 */
export const getComments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const post = await Post.findById(id);
    
    if (!post) {
      return res.status(404).json(new ApiResponse(false, 'Post not found'));
    }

    // Get top-level comments (not replies)
    const comments = await Comment.find({ post: id, parentComment: null })
      .populate('author', 'name email')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'name email'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Check which comments the user has liked
    const commentIds = comments.flatMap(comment => [
      comment._id,
      ...comment.replies.map((reply: any) => reply._id)
    ]);

    const userLikes = await Like.find({
      user: userId,
      comment: { $in: commentIds }
    });

    const likedCommentIds = userLikes.map(like => like.comment?.toString());

    // Add like information to comments
    const commentsWithLikes = await Promise.all(
      comments.map(async (comment:IComment) => {
        if (!comment._id) {
          return null;
        }
        const likeCount = await Like.countDocuments({ comment: comment._id });
        const isLiked = likedCommentIds.includes(comment._id.toString());
        
        const repliesWithLikes = await Promise.all(
          comment.replies.map(async (reply: any) => {
            const replyLikeCount = await Like.countDocuments({ comment: reply._id });
            const isReplyLiked = likedCommentIds.includes(reply._id.toString());
            
            return {
              ...reply.toObject(),
              likeCount: replyLikeCount,
              isLiked: isReplyLiked
            };
          })
        );

        return {
          ...comment.toObject(),
          likeCount,
          isLiked,
          replies: repliesWithLikes
        };
      })
    );

    const total = await Comment.countDocuments({ post: id, parentComment: null });

    res.status(200).json(new ApiResponse(true, 'Comments fetched successfully', {
      comments: commentsWithLikes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error: any) {
    console.error('Get comments error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to fetch comments'));
  }
};

/**
 * Like a comment
 */
export const likeComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const comment = await Comment.findById(id);
    
    if (!comment) {
      return res.status(404).json(new ApiResponse(false, 'Comment not found'));
    }

    // Check if already liked
    const existingLike = await Like.findOne({ user: userId, comment: id });
    if (existingLike) {
      return res.status(400).json(new ApiResponse(false, 'Comment already liked'));
    }

    // Create new like
    const like = new Like({
      user: userId,
      comment: id
    });

    await like.save();

    res.status(200).json(new ApiResponse(true, 'Comment liked successfully'));
  } catch (error: any) {
    console.error('Like comment error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to like comment'));
  }
};

/**
 * Unlike a comment
 */
export const unlikeComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const result = await Like.findOneAndDelete({ user: userId, comment: id });
    
    if (!result) {
      return res.status(404).json(new ApiResponse(false, 'Like not found'));
    }

    res.status(200).json(new ApiResponse(true, 'Comment unliked successfully'));
  } catch (error: any) {
    console.error('Unlike comment error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to unlike comment'));
  }
};

/**
 * Get personalized feed for user
 */
export const getFeed = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get posts that user hasn't interacted with
    const likedPosts = await Like.find({ user: userId }).distinct('post');
    const userPosts = await Post.find({ author: userId }).distinct('_id');
    
    const excludedPosts = [...likedPosts, ...userPosts].filter(id => id).map(id => id.toString());

    const posts = await Post.find({
      isPublic: true,
      _id: { $nin: excludedPosts }
    })
    .populate('author', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const total = await Post.countDocuments({
      isPublic: true,
      _id: { $nin: excludedPosts }
    });

    // Add like and comment counts
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const likeCount = await Like.countDocuments({ post: post._id });
        const commentCount = await Comment.countDocuments({ post: post._id });
        
        return {
          ...post.toObject(),
          likeCount,
          commentCount
        };
      })
    );

    res.status(200).json(new ApiResponse(true, 'Feed fetched successfully', {
      posts: postsWithCounts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error: any) {
    console.error('Get feed error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to fetch feed'));
  }
};

/**
 * Get user's posts
 */
export const getUserPosts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ author: userId })
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ author: userId });

    // Add like and comment counts
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const likeCount = await Like.countDocuments({ post: post._id });
        const commentCount = await Comment.countDocuments({ post: post._id });
        const isLiked = await Like.exists({ user: userId, post: post._id });
        const isBookmarked = await Bookmark.exists({ user: userId, post: post._id });
        
        return {
          ...post.toObject(),
          likeCount,
          commentCount,
          isLiked: !!isLiked,
          isBookmarked: !!isBookmarked
        };
      })
    );

    res.status(200).json(new ApiResponse(true, 'User posts fetched successfully', {
      posts: postsWithCounts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error: any) {
    console.error('Get user posts error:', error);
    res.status(500).json(new ApiResponse(false, 'Failed to fetch user posts'));
  }
};